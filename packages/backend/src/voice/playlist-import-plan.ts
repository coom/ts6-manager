/** Pure planning for a playlist import. No I/O, no Prisma, no yt-dlp. */

export interface PlanEntry {
  id: string;
  title: string;
  url: string;
}

export interface ImportPlan {
  /** Entries to download, in playlist order, already capped. */
  toImport: PlanEntry[];
  /** Entries already attached to the playlist; reported, never re-fetched. */
  alreadyPresent: PlanEntry[];
  /** How many candidates the cap cut. */
  truncated: number;
}

/** Canonical watch URL, used as the identity of a track across imports. */
export function youtubeWatchUrl(videoId: string): string {
  return `https://www.youtube.com/watch?v=${videoId}`;
}

/** Hosts whose `list=` parameter actually denotes a YouTube playlist. */
const YOUTUBE_PLAYLIST_HOSTS = new Set([
  'youtube.com', 'www.youtube.com', 'm.youtube.com', 'music.youtube.com',
]);

/**
 * True only for a URL that *is* a playlist, e.g. `/playlist?list=PL…`.
 *
 * YouTube appends `&list=` to the address bar of every video opened from a
 * playlist, and `&list=RD…` to everything reached by autoplay/Mix. Those URLs
 * carry a `v=` too and must stay single-video plays — `!play` on the link a
 * user copied has to play *that* video, and chat offers no way to say "just
 * this one". So a `list=` only counts when there is no `v=` beside it.
 *
 * Parsed rather than substring-matched so a `?list=` on an unrelated host, or
 * a malformed URL, never triggers a 50-track import. `youtu.be` is excluded on
 * purpose: it carries the video id in the path, so it has no `v=` to check.
 */
export function isYouTubePlaylistUrl(raw: string): boolean {
  let url: URL;
  try {
    url = new URL(raw);
  } catch {
    return false;
  }
  if (!YOUTUBE_PLAYLIST_HOSTS.has(url.hostname.toLowerCase())) return false;
  return url.searchParams.has('list') && !url.searchParams.has('v');
}

/**
 * Split a playlist's entries into what to fetch and what is already there.
 *
 * `attachedUrls` holds the source URLs already attached to *this playlist*, not
 * merely present in the song library. A track the library holds but the
 * playlist does not is still planned: the download short-circuits on the disk
 * cache and only the join row is created. Keying on library presence instead
 * would silently fail to attach it.
 *
 * The cap bounds downloads, so it applies only to candidates — already-present
 * entries never consume it, or a mostly-imported playlist would stop making
 * progress.
 */
export function planImport(entries: PlanEntry[], attachedUrls: Set<string>, cap: number): ImportPlan {
  const alreadyPresent: PlanEntry[] = [];
  const candidates: PlanEntry[] = [];

  for (const entry of entries) {
    if (!entry.id) continue; // unusable entry from a malformed feed
    if (attachedUrls.has(entry.url)) {
      alreadyPresent.push(entry);
    } else {
      candidates.push(entry);
    }
  }

  const limit = Math.max(0, cap);
  return {
    toImport: candidates.slice(0, limit),
    alreadyPresent,
    truncated: Math.max(0, candidates.length - limit),
  };
}
