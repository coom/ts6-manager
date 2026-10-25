import { randomUUID } from 'crypto';
import fs from 'fs';
import type { PrismaClient } from '../../generated/prisma/index.js';
import { getYouTubeUrlInfo, downloadYouTube } from './audio/youtube.js';
import { validateUrl } from '../utils/url-validator.js';
import { planImport, youtubeWatchUrl, type ImportPlan, type PlanEntry } from './playlist-import-plan.js';
import { parseImportCap, MAX_PLAYLIST_IMPORT_KEY } from '../utils/app-settings.js';
import { MUSIC_DIR } from './music-ops.js';

export interface ImportFailure {
  videoId: string;
  title: string;
  reason: string;
}

export interface ImportJob {
  jobId: string;
  status: 'running' | 'done' | 'error';
  playlistId: number | null;
  playlistName: string;
  total: number;
  done: number;
  skipped: number;
  truncated: number;
  failures: ImportFailure[];
  error: string | null;
}

export interface ImportedSong {
  id: number;
  /** YouTube video id. Queue item ids are built from it, not from the DB row. */
  videoId: string;
  title: string;
  artist: string | null;
  duration: number | null;
  filePath: string;
  sourceUrl: string;
}

export interface ImportRequest {
  url: string;
  serverConfigId: number;
  musicBotId?: number | null;
  /** Called after each track lands, in playlist order. Used by !play to enqueue progressively. */
  onTrack?: (song: ImportedSong, index: number) => Promise<void> | void;
}

export type StartResult =
  | { kind: 'started'; job: ImportJob }
  | { kind: 'not-a-playlist' }
  | { kind: 'busy' };

/** Jobs are kept for an hour after finishing so a slow poller still sees the result. */
const JOB_RETENTION_MS = 60 * 60 * 1000;

export class PlaylistImporter {
  private jobs = new Map<string, { job: ImportJob; finishedAt: number | null }>();
  /** One import at a time per server config — they share MUSIC_DIR and one yt-dlp rate limit. */
  private active = new Set<number>();

  constructor(private prisma: PrismaClient) {}

  get(jobId: string): ImportJob | undefined {
    this.sweep();
    return this.jobs.get(jobId)?.job;
  }

  async start(req: ImportRequest): Promise<StartResult> {
    // Bound this.jobs regardless of whether any caller ever polls get(): every
    // new import sweeps out finished jobs older than JOB_RETENTION_MS.
    this.sweep();

    if (this.active.has(req.serverConfigId)) return { kind: 'busy' };
    // Acquire the slot synchronously, before the first await. Every await
    // below yields to the event loop, and a second start() for the same
    // server config racing in during one of them must see the slot already
    // taken — checking this.active again after an await would be too late.
    this.active.add(req.serverConfigId);

    // Released on every exit path except a successful hand-off to run(),
    // which releases it itself once the background work finishes.
    let handedOff = false;
    try {
      const check = await validateUrl(req.url, { allowedProtocols: ['http:', 'https:'] });
      if (!check.valid) throw new Error(`URL blocked: ${check.error}`);

      const info = await getYouTubeUrlInfo(req.url);
      if (info.type !== 'playlist' || !info.sourceId) return { kind: 'not-a-playlist' };

      const playlist = await this.findOrCreatePlaylist(
        req.serverConfigId, info.sourceId, info.title, req.musicBotId ?? null,
      );

      const attached = await this.attachedUrls(playlist.id);
      const cap = await this.cap();
      const entries: PlanEntry[] = info.items.map((i) => ({
        id: i.id, title: i.title, url: youtubeWatchUrl(i.id),
      }));
      const plan = planImport(entries, attached, cap);

      const job: ImportJob = {
        jobId: randomUUID(),
        status: 'running',
        playlistId: playlist.id,
        playlistName: playlist.name,
        total: plan.toImport.length,
        done: 0,
        skipped: plan.alreadyPresent.length,
        truncated: plan.truncated,
        failures: [],
        error: null,
      };
      this.jobs.set(job.jobId, { job, finishedAt: null });

      // Background: the caller already has the name and the count. Handing
      // off keeps the slot held until run() (and its own error handling)
      // finishes, so the finally below must not release it too.
      handedOff = true;
      void this.run(job, plan, req)
        .catch((err: any) => {
          // run()'s per-entry try/catch already shields every track, so this
          // only fires if a future edit adds unguarded work to run(). Without
          // it the job would freeze at 'running' forever with no trace for a
          // poller — surface it instead.
          job.status = 'error';
          job.error = err?.message ? String(err.message).slice(0, 500) : 'Unknown error';
          console.error(`[PlaylistImport] job ${job.jobId} failed: ${err?.message}`, err);
        })
        .finally(() => {
          this.active.delete(req.serverConfigId);
          const entry = this.jobs.get(job.jobId);
          if (entry) entry.finishedAt = Date.now();
        });

      return { kind: 'started', job };
    } finally {
      if (!handedOff) this.active.delete(req.serverConfigId);
    }
  }

  private async run(job: ImportJob, plan: ImportPlan, req: ImportRequest): Promise<void> {
    // Tracks already in the playlist are emitted first, in playlist order, so
    // a re-import still plays. They cost no download, so this is instant.
    let emitted = await this.emitAlreadyPresent(plan.alreadyPresent, req);

    for (const entry of plan.toImport) {
      let song: ImportedSong;
      try {
        song = await this.importOne(entry, req.serverConfigId, job.playlistId!);
        job.done++;
      } catch (err: any) {
        // Deleted, private and geo-blocked videos are routine in real
        // playlists; one of them must never abort the rest.
        job.failures.push({
          videoId: entry.id,
          title: entry.title,
          reason: err?.message ? String(err.message).slice(0, 200) : 'Unknown error',
        });
        console.warn(`[PlaylistImport] ${entry.id} failed: ${err?.message}`);
        continue;
      }

      // The track above already succeeded: its Song/PlaylistSong rows are
      // persisted, so job.done must stand regardless of what onTrack does.
      // Its own try/catch keeps a playback-layer failure (e.g. the bot
      // disconnected mid-import) from being recorded as an import failure —
      // that would misreport a track that imported fine.
      if (req.onTrack) {
        try {
          await req.onTrack(song, emitted++);
        } catch (err: any) {
          console.warn(`[PlaylistImport] onTrack callback failed for ${entry.id}: ${err?.message}`);
        }
      }
    }
    job.status = 'done';
  }

  /**
   * Hand the already-attached tracks to onTrack before the download loop, and
   * return the next emission index.
   *
   * Idempotency is a *library* contract: a second import of the same playlist
   * must not duplicate rows. It is not a *playback* contract. `!play` on a
   * playlist imported yesterday plans zero downloads, so without this the bot
   * would announce the import and then sit in silence — and a partial
   * re-import would play only the handful of new tracks.
   *
   * job.done is deliberately left alone: it counts what THIS job imported, and
   * job.skipped already reports this group. Callers with no onTrack (the web
   * route) do no work here at all.
   */
  private async emitAlreadyPresent(entries: PlanEntry[], req: ImportRequest): Promise<number> {
    const onTrack = req.onTrack;
    if (!onTrack || entries.length === 0) return 0;

    let emitted = 0;
    for (const entry of entries) {
      // Same isolation as the download loop: neither the lookup nor the
      // playback callback may abort the import that follows.
      try {
        const song = await this.prisma.song.findFirst({
          where: { sourceUrl: entry.url, serverConfigId: req.serverConfigId },
        });
        // Attached without a resolvable library row (hand-edited DB): nothing
        // to play, and nothing to report — the import itself is unaffected.
        if (!song) continue;
        await onTrack({
          id: song.id,
          videoId: entry.id,
          title: song.title,
          artist: song.artist,
          duration: song.duration,
          filePath: song.filePath,
          sourceUrl: entry.url,
        }, emitted++);
      } catch (err: any) {
        console.warn(`[PlaylistImport] replay of already-present ${entry.id} failed: ${err?.message}`);
      }
    }
    return emitted;
  }

  private async importOne(entry: PlanEntry, serverConfigId: number, playlistId: number): Promise<ImportedSong> {
    const { filePath, info } = await downloadYouTube(entry.url, MUSIC_DIR);
    // Both other download paths record the size; without it the library shows
    // imported tracks with a blank size.
    const fileSize = fs.statSync(filePath).size;

    // Reuse the library row when this URL is already known for this server, so
    // a track shared by two playlists is stored once. Not an upsert keyed on a
    // sentinel id — sourceUrl has no unique constraint, so there is no compound
    // key to upsert against.
    const existing = await this.prisma.song.findFirst({
      where: { sourceUrl: entry.url, serverConfigId },
    });
    const song = existing ?? (await this.prisma.song.create({
      data: {
        title: info.title,
        artist: info.artist,
        duration: info.duration,
        filePath,
        source: 'youtube',
        sourceUrl: entry.url,
        fileSize,
        serverConfigId,
      },
    }));

    const maxPos = await this.prisma.playlistSong.aggregate({
      where: { playlistId },
      _max: { position: true },
    });
    await this.prisma.playlistSong.upsert({
      where: { playlistId_songId: { playlistId, songId: song.id } },
      update: {},
      create: { playlistId, songId: song.id, position: (maxPos._max.position ?? -1) + 1 },
    });

    return {
      id: song.id,
      videoId: entry.id,
      title: song.title,
      artist: song.artist,
      duration: song.duration,
      filePath: song.filePath,
      sourceUrl: entry.url,
    };
  }

  private async findOrCreatePlaylist(
    serverConfigId: number, sourceId: string, title: string, musicBotId: number | null,
  ) {
    const existing = await this.prisma.playlist.findUnique({
      where: { serverConfigId_sourceId: { serverConfigId, sourceId } },
    });
    // An existing playlist keeps its local name: renaming it in the UI must not
    // be undone by the next import.
    if (existing) return existing;

    return this.prisma.playlist.create({
      data: { name: title, sourceId, serverConfigId, musicBotId },
    });
  }

  private async attachedUrls(playlistId: number): Promise<Set<string>> {
    const rows = await this.prisma.playlistSong.findMany({
      where: { playlistId },
      select: { song: { select: { sourceUrl: true } } },
    });
    return new Set(rows.map((r: any) => r.song.sourceUrl).filter(Boolean));
  }

  private async cap(): Promise<number> {
    const row = await this.prisma.appSetting.findUnique({ where: { key: MAX_PLAYLIST_IMPORT_KEY } });
    return parseImportCap(row?.value);
  }

  private sweep(): void {
    const cutoff = Date.now() - JOB_RETENTION_MS;
    for (const [id, entry] of this.jobs) {
      if (entry.finishedAt !== null && entry.finishedAt < cutoff) this.jobs.delete(id);
    }
  }
}
