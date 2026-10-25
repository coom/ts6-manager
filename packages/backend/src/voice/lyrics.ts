/**
 * Lyrics lookup shared by the TS (!lyrics) and Discord (/lyrics) commands.
 * Sources: LRCLIB (no API key) with a lyrics.ovh fallback. Pure helpers
 * (title cleaning, chunking) live here too so both bridges stay thin.
 */

const FETCH_TIMEOUT_MS = 10_000;
const USER_AGENT = 'ts6-manager';

export interface LyricsResult {
  artist: string;
  title: string;
  lyrics: string;
  source: 'lrclib' | 'lyrics.ovh';
  instrumental: boolean;
}

export interface LyricsQuery {
  artist?: string;
  title?: string;
  query?: string;
}

/**
 * Strips the noise YouTube appends to track titles — "(Official Video)",
 * "[Clip Officiel]", "(Lyrics)", "HD", "4K", … — so the title can be used
 * as a lyrics search term. Parentheses that are part of the actual title
 * (no noise keyword inside) are preserved.
 */
export function cleanTrackTitle(title: string): string {
  const NOISE = /(official|officiel|video|vidéo|clip|lyric|paroles|audio|visuali[sz]er|remaster|\b(hd|4k|mv)\b)/i;
  return title
    .replace(/[([{][^()[\]{}]*[)\]}]/g, (m) => (NOISE.test(m) ? ' ' : m))
    .replace(/\s{2,}/g, ' ')
    .trim();
}

/**
 * Splits `header + lyrics` into chunks of at most `maxLen` characters,
 * cutting only on line boundaries (a single line longer than maxLen is
 * hard-split as a degenerate case). Empty chunks are dropped.
 */
export function chunkLyrics(header: string, lyrics: string, maxLen: number): string[] {
  const text = header ? `${header}\n${lyrics}` : lyrics;
  const chunks: string[] = [];
  let buf: string | null = null;
  for (let line of text.split('\n')) {
    while (line.length > maxLen) {
      if (buf !== null) { chunks.push(buf); buf = null; }
      chunks.push(line.slice(0, maxLen));
      line = line.slice(maxLen);
    }
    if (buf === null) buf = line;
    else if (buf.length + 1 + line.length <= maxLen) buf += '\n' + line;
    else { chunks.push(buf); buf = line; }
  }
  if (buf !== null) chunks.push(buf);
  return chunks.map((c) => c.trim() === '' ? '' : c).filter((c) => c !== '');
}

/** Artist placeholders emitted by the downloaders when metadata is missing. */
const UNKNOWN_ARTIST_SENTINELS = new Set(['Unknown', 'Unknown Artist']);

/**
 * Builds the fetchLyrics input and the user-facing label for a now-playing
 * track: placeholder artists are treated as absent and the title is cleaned
 * for search while the label keeps the original title.
 */
export function lyricsInputFromTrack(np: { artist?: string; title: string }): { input: LyricsQuery; label: string } {
  const artist = np.artist && !UNKNOWN_ARTIST_SENTINELS.has(np.artist) ? np.artist : undefined;
  return {
    input: { artist, title: cleanTrackTitle(np.title) },
    label: `${artist ? `${artist} — ` : ''}${np.title}`,
  };
}

/** GET a JSON endpoint; null on any error, non-2xx or timeout. */
async function getJson(url: string): Promise<unknown | null> {
  try {
    const res = await fetch(url, {
      headers: { 'User-Agent': USER_AGENT },
      signal: AbortSignal.timeout(FETCH_TIMEOUT_MS),
    });
    if (!res.ok) return null;
    return await res.json();
  } catch {
    return null;
  }
}

/** Maps an LRCLIB record to a LyricsResult; null if it has no usable lyrics. */
function toLrclibResult(entry: any): LyricsResult | null {
  if (!entry || typeof entry !== 'object') return null;
  const artist = String(entry.artistName ?? '');
  const title = String(entry.trackName ?? '');
  if (entry.instrumental === true) {
    return { artist, title, lyrics: '', source: 'lrclib', instrumental: true };
  }
  const lyrics = typeof entry.plainLyrics === 'string' ? entry.plainLyrics.trim() : '';
  if (!lyrics) return null;
  return { artist, title, lyrics, source: 'lrclib', instrumental: false };
}

/**
 * Fetches lyrics for a track. Cascade: LRCLIB exact match (when artist and
 * title are known) → LRCLIB fuzzy search → lyrics.ovh (artist+title only).
 * Every step swallows its own errors; null means "not found anywhere".
 */
export async function fetchLyrics(input: LyricsQuery): Promise<LyricsResult | null> {
  const artist = input.artist?.trim() ?? '';
  const title = input.title?.trim() ?? '';
  const query = input.query?.trim() || [artist, title].filter(Boolean).join(' ');

  // 1. LRCLIB exact match
  if (artist && title) {
    const data = await getJson(
      `https://lrclib.net/api/get?artist_name=${encodeURIComponent(artist)}&track_name=${encodeURIComponent(title)}`,
    );
    const r = toLrclibResult(data);
    if (r) return r;
  }

  // 2. LRCLIB fuzzy search — first entry with usable lyrics wins
  if (query) {
    const data = await getJson(`https://lrclib.net/api/search?q=${encodeURIComponent(query)}`);
    if (Array.isArray(data)) {
      for (const entry of data) {
        const r = toLrclibResult(entry);
        if (r) return r;
      }
    }
  }

  // 3. lyrics.ovh fallback
  if (artist && title) {
    const data = await getJson(
      `https://api.lyrics.ovh/v1/${encodeURIComponent(artist)}/${encodeURIComponent(title)}`,
    ) as { lyrics?: unknown } | null;
    const lyrics = typeof data?.lyrics === 'string' ? data.lyrics.trim() : '';
    if (lyrics) return { artist, title, lyrics, source: 'lyrics.ovh', instrumental: false };
  }

  return null;
}
