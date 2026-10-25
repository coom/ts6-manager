import type { PrismaClient } from '../../generated/prisma/index.js';
import type { VoiceBot } from './voice-bot.js';
import type { QueueItem } from './playlist/queue.js';
import { downloadYouTube, searchYouTube } from './audio/youtube.js';
import { decrypt } from '../utils/crypto.js';
import { validateUrl } from '../utils/url-validator.js';
import {
  resolveSpotifyInput,
  findBestYouTubeForSpotify,
  type SpotifyConfig,
} from './audio/spotify.js';

export { isSpotifyUrl } from './audio/spotify.js';

export const MUSIC_DIR = process.env.MUSIC_DIR || '/data/music';

const SPOTIFY_REQUEST_TIMEOUT_MS = 10000;

/** Load Spotify credentials from the DB, or null if disabled / not set. */
export async function loadSpotifyConfig(prisma: PrismaClient): Promise<(SpotifyConfig & { maxAlbumTracks: number }) | null> {
  const s = await prisma.spotifySettings.findFirst();
  if (!s?.enabled || !s.clientId || !s.clientSecret) return null;
  let clientSecret: string;
  try {
    clientSecret = decrypt(s.clientSecret);
  } catch {
    return null;
  }
  return {
    clientId: s.clientId,
    clientSecret,
    requestTimeoutMs: SPOTIFY_REQUEST_TIMEOUT_MS,
    maxAlbumTracks: Math.max(1, s.maxAlbumTracks || 50),
  };
}

export interface SpotifyEnqueueResult {
  type: 'track' | 'album';
  name: string;
  added: number;
  total: number;
  failed: string[];
  firstStarted: boolean;
}

/**
 * Resolve a Spotify track/album link to metadata, match each track on
 * YouTube, and enqueue. The first track plays if the bot is idle; the rest
 * queue. Per-track failures are collected, not fatal.
 */
export async function enqueueSpotify(
  prisma: PrismaClient,
  bot: VoiceBot,
  config: SpotifyConfig & { maxAlbumTracks: number },
  url: string,
): Promise<SpotifyEnqueueResult> {
  const resolved = await resolveSpotifyInput(url, config);
  const tracks = resolved.tracks.slice(0, config.maxAlbumTracks);

  const failed: string[] = [];
  let added = 0;
  let firstStarted = false;

  for (const track of tracks) {
    try {
      const yt = await findBestYouTubeForSpotify(track);
      const { filePath } = await downloadYouTube(`https://www.youtube.com/watch?v=${yt.id}`, MUSIC_DIR);

      const item: QueueItem = {
        id: `sp_${track.id}_${yt.id}`,
        title: track.title,
        artist: track.artist,
        duration: track.durationMs ? Math.round(track.durationMs / 1000) : undefined,
        filePath,
        source: 'youtube',
        sourceUrl: track.spotifyUrl,
      };

      bot.queue.add(item);
      saveMusicRequest(prisma, bot, item);

      if (!firstStarted && bot.status !== 'playing' && bot.status !== 'paused') {
        bot.queue.playAt(bot.queue.length - 1);
        await bot.play(item);
        firstStarted = true;
      }
      added++;
    } catch (err: any) {
      failed.push(`${track.artist} - ${track.title}: ${err.message}`);
    }
  }

  return { type: resolved.type, name: resolved.name, added, total: tracks.length, failed, firstStarted };
}

/**
 * Transport-agnostic music operations shared by the TS chat commands
 * (!play) and the Discord slash commands (/play).
 */

/** URL passthrough, or YouTube search → URL of the first result. */
export async function resolvePlayQuery(query: string): Promise<string> {
  const q = query.trim();
  if (q.startsWith('http://') || q.startsWith('https://')) return q;
  const results = await searchYouTube(q, 1);
  if (results.length === 0 || !results[0].id) {
    throw new Error(`No YouTube result for "${q}"`);
  }
  return `https://www.youtube.com/watch?v=${results[0].id}`;
}

export interface PlayResult {
  item: QueueItem;
  /** true: added behind the current track; false: started playing right away */
  queued: boolean;
}

/**
 * Download a YouTube URL, enqueue it, persist the request history, and start
 * playback unless something is already playing.
 */
export async function downloadAndEnqueue(prisma: PrismaClient, bot: VoiceBot, url: string): Promise<PlayResult> {
  // !play / !queue are reachable by any TS or Discord user when no command
  // server-group is configured, so the URL is untrusted: block private ranges
  // and cloud-metadata endpoints before yt-dlp fetches it.
  const check = await validateUrl(url, { allowedProtocols: ['http:', 'https:'] });
  if (!check.valid) {
    throw new Error(`URL blocked: ${check.error}`);
  }

  const { filePath, info } = await downloadYouTube(url, MUSIC_DIR);

  const item: QueueItem = {
    id: `yt_${info.id}`,
    title: info.title,
    artist: info.artist,
    duration: info.duration,
    filePath,
    source: 'youtube',
    sourceUrl: url,
  };

  bot.queue.add(item);
  saveMusicRequest(prisma, bot, item);

  if (bot.status === 'playing' || bot.status === 'paused') {
    return { item, queued: true };
  }

  bot.queue.playAt(bot.queue.length - 1);
  await bot.play(item);
  return { item, queued: false };
}

/** Fire-and-forget history entry (one row per server+url, refreshed on replay). */
export function saveMusicRequest(prisma: PrismaClient, bot: VoiceBot, item: QueueItem): void {
  if (!item.sourceUrl || !bot.currentConfig.serverConfigId) return;
  prisma.musicRequest.upsert({
    where: {
      serverConfigId_url: {
        serverConfigId: bot.currentConfig.serverConfigId,
        url: item.sourceUrl,
      },
    },
    update: {
      requestedAt: new Date(),
      title: item.title || 'Unknown Title',
    },
    create: {
      serverConfigId: bot.currentConfig.serverConfigId,
      url: item.sourceUrl,
      title: item.title || 'Unknown Title',
      requestedAt: new Date(),
    },
  }).catch((err: any) => {
    console.error('[MusicOps] Failed to save music request history:', err.message);
  });
}
