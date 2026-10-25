import { spawn } from "child_process";
import path from "path";
import fs from "fs";

export interface YouTubeInfo {
  id: string;
  title: string;
  artist: string;
  duration: number; // seconds
  thumbnail: string;
  url: string;
}

export interface YouTubeSearchResult {
  id: string;
  title: string;
  artist: string;
  duration: number;
  thumbnail: string;
}

// Shared cookie file path (set from settings)
let ytCookieFile: string | null = null;

export function setYtCookieFile(filePath: string | null): void {
  ytCookieFile = filePath;
}

export function getYtCookieFile(): string | null {
  return ytCookieFile;
}

export function getCookieArgs(): string[] {
  const args: string[] = ["--remote-components", "ejs:github"];
  if (ytCookieFile) {
    args.push("--cookies", ytCookieFile);
  }
  return args;
}

/**
 * Reject a URL that yt-dlp/ffmpeg would parse as an option rather than a
 * positional. `--config-location=<path>` is the dangerous case: it pulls in a
 * config file that can carry `--exec`, giving command execution. Call sites
 * also place a literal `--` before the URL; this rejects hostile input earlier.
 */
export function assertSafeUrl(url: string): void {
  if (url.startsWith("-")) {
    throw new Error('Invalid URL: must not start with "-"');
  }
}

// The first run may also fetch remote challenge-solver components, so the
// info timeout is generous.
const INFO_TIMEOUT_MS = 60_000;
const DOWNLOAD_TIMEOUT_MS = 10 * 60_000;

/**
 * Run yt-dlp with a hard timeout. Resolves with stdout; rejects with a short
 * user-facing message while the full stderr goes to the backend log.
 * lowPriority (default) runs through nice -n 19 so downloads (and the
 * conversion ffmpeg yt-dlp spawns, which inherits the niceness) don't steal
 * cycles from the realtime playback pipeline; latency-sensitive callers
 * (e.g. stream URL resolution) pass lowPriority: false.
 */
export function runYtDlp(args: string[], timeoutMs: number, opts: { lowPriority?: boolean } = {}): Promise<string> {
  return new Promise((resolve, reject) => {
    const useNice = (opts.lowPriority ?? true) && process.platform !== "win32";
    const proc = useNice
      ? spawn("nice", ["-n", "19", "yt-dlp", ...args], { shell: false })
      : spawn("yt-dlp", args, { shell: false });

    let stdout = "";
    let stderr = "";
    let timedOut = false;

    const timer = setTimeout(() => {
      timedOut = true;
      proc.kill("SIGKILL");
    }, timeoutMs);

    proc.stdout.on("data", (chunk: Buffer) => { stdout += chunk.toString(); });
    proc.stderr.on("data", (chunk: Buffer) => { stderr += chunk.toString(); });

    proc.on("error", (err) => {
      clearTimeout(timer);
      reject(new Error(`yt-dlp not found: ${err.message}`));
    });

    proc.on("close", (code) => {
      clearTimeout(timer);
      if (timedOut) {
        console.error(`[yt-dlp] Timed out after ${timeoutMs / 1000}s: yt-dlp ${args.join(" ")}`);
        return reject(new Error(`yt-dlp timed out after ${timeoutMs / 1000}s`));
      }
      if (code !== 0) {
        console.error(`[yt-dlp] Failed (code ${code}): yt-dlp ${args.join(" ")}\n${stderr.slice(-2000)}`);
        return reject(new Error(`yt-dlp failed (code ${code}): ${lastErrorLine(stderr)}`));
      }
      resolve(stdout);
    });
  });
}

// The actionable message ("Sign in to confirm you're not a bot", "Video
// unavailable", ...) is on the ERROR line, usually at the very end.
function lastErrorLine(stderr: string): string {
  const lines = stderr.trim().split("\n").filter(Boolean);
  const errLine = [...lines].reverse().find((l) => l.startsWith("ERROR"));
  return (errLine || lines[lines.length - 1] || "unknown error").slice(0, 300);
}

const TEMP_SUFFIXES = [".part", ".ytdl", ".download"];
const NON_AUDIO_SUFFIXES = [".json", ".webp", ".jpg", ".jpeg", ".png", ".description", ".lrc", ".srt", ".vtt"];
const AUDIO_PREFERENCE = [".opus", ".m4a", ".mp3", ".ogg", ".oga", ".flac", ".wav", ".webm", ".mka", ".aac"];

/**
 * Pick the real downloaded audio file among directory entries matching the
 * video ID. Temp artifacts (.part/.ytdl) from interrupted downloads and
 * metadata sidecars must never win over the converted audio file.
 */
export function pickDownloadedFile(candidates: string[], id: string): string | null {
  const usable = candidates.filter((f) => {
    if (!f.startsWith(id)) return false;
    const lower = f.toLowerCase();
    if (TEMP_SUFFIXES.some((s) => lower.endsWith(s))) return false;
    if (lower.includes(".temp.")) return false;
    if (NON_AUDIO_SUFFIXES.some((s) => lower.endsWith(s))) return false;
    return true;
  });

  for (const ext of AUDIO_PREFERENCE) {
    const exact = usable.find((f) => f.toLowerCase() === `${id.toLowerCase()}${ext}`);
    if (exact) return exact;
  }
  return usable[0] ?? null;
}

// Remove temp artifacts a previously interrupted download may have left, so
// they can't be mistaken for (or collide with) the new download.
function cleanupStaleArtifacts(outputDir: string, id: string): void {
  let entries: string[];
  try {
    entries = fs.readdirSync(outputDir);
  } catch {
    return;
  }
  for (const f of entries) {
    const lower = f.toLowerCase();
    if (f.startsWith(id) && (TEMP_SUFFIXES.some((s) => lower.endsWith(s)) || lower.includes(".temp."))) {
      try {
        fs.rmSync(path.join(outputDir, f));
        console.log(`[yt-dlp] Removed stale artifact: ${f}`);
      } catch { /* best effort */ }
    }
  }
}

// Concurrent requests for the same URL (UI + !play command, double click)
// would run two yt-dlp processes writing the same output file. Share the
// in-flight download instead.
const inFlight = new Map<string, Promise<{ filePath: string; info: YouTubeInfo }>>();

/**
 * Download audio from a YouTube URL using yt-dlp
 */
export function downloadYouTube(url: string, outputDir: string): Promise<{ filePath: string; info: YouTubeInfo }> {
  assertSafeUrl(url);
  const existing = inFlight.get(url);
  if (existing) return existing;

  const task = doDownload(url, outputDir).finally(() => inFlight.delete(url));
  inFlight.set(url, task);
  return task;
}

async function doDownload(url: string, outputDir: string): Promise<{ filePath: string; info: YouTubeInfo }> {
  // First get info
  const infoJson = await runYtDlp(
    [...getCookieArgs(), "--dump-json", "--no-playlist", "--", url],
    INFO_TIMEOUT_MS,
  );

  let parsed: any;
  try {
    parsed = JSON.parse(infoJson);
  } catch {
    throw new Error("Failed to parse yt-dlp output");
  }

  const info: YouTubeInfo = {
    id: parsed.id,
    title: parsed.title || "Unknown",
    artist: parsed.uploader || parsed.channel || "Unknown",
    duration: parsed.duration || 0,
    thumbnail: parsed.thumbnail || "",
    url,
  };

  const expectedPath = path.join(outputDir, `${info.id}.opus`);

  // Check if already downloaded
  if (fs.existsSync(expectedPath)) {
    console.log(`[yt-dlp] Cache hit for ${info.id} (${info.title})`);
    return { filePath: expectedPath, info };
  }

  cleanupStaleArtifacts(outputDir, info.id);

  console.log(`[yt-dlp] Downloading ${info.id} (${info.title})...`);
  const startedAt = Date.now();

  // Download audio only
  await runYtDlp(
    [
      ...getCookieArgs(),
      "-x",                       // extract audio
      "--audio-format", "opus",   // opus format (native for TS3)
      "--audio-quality", "0",     // best quality
      "--no-playlist",
      "--no-progress",
      "-o", path.join(outputDir, "%(id)s.%(ext)s"),
      "--",
      url,
    ],
    DOWNLOAD_TIMEOUT_MS,
  );

  // yt-dlp may use different extensions, find the actual file
  const candidates = fs.readdirSync(outputDir).filter((f) => f.startsWith(info.id));
  const fileName = pickDownloadedFile(candidates, info.id);
  if (!fileName) {
    throw new Error("Downloaded file not found");
  }

  console.log(`[yt-dlp] Downloaded ${fileName} in ${Math.round((Date.now() - startedAt) / 1000)}s`);
  return { filePath: path.join(outputDir, fileName), info };
}

export interface UrlInfo {
  type: 'video' | 'playlist';
  title: string;
  /** YouTube playlist id; null for a single video. */
  sourceId: string | null;
  items: YouTubeSearchResult[];
}

function toSearchResult(e: any): YouTubeSearchResult {
  return {
    id: e.id,
    title: e.title || 'Unknown',
    artist: e.uploader || e.channel || 'Unknown',
    duration: e.duration || 0,
    thumbnail: e.thumbnails?.[0]?.url || e.thumbnail || '',
  };
}

/**
 * Parse `yt-dlp --dump-single-json` output.
 *
 * A playlist is identified by the presence of `entries`, not by counting items:
 * a playlist holding one video is still a playlist, and the previous
 * `items.length > 1` heuristic silently imported it as a bare video.
 */
export function parseUrlInfo(raw: string): UrlInfo {
  let data: any;
  try {
    data = JSON.parse(raw);
  } catch {
    throw new Error('Failed to parse yt-dlp output');
  }

  if (Array.isArray(data?.entries)) {
    return {
      type: 'playlist',
      title: data.title || 'Untitled playlist',
      sourceId: data.id ?? null,
      // --flat-playlist emits null for deleted or private videos.
      items: data.entries.filter(Boolean).map(toSearchResult),
    };
  }

  return {
    type: 'video',
    title: data?.title || 'Unknown',
    sourceId: null,
    items: [toSearchResult(data ?? {})],
  };
}

/** Resolve a YouTube URL to its type, title and entries. */
export async function getYouTubeUrlInfo(url: string): Promise<UrlInfo> {
  assertSafeUrl(url);
  const output = await runYtDlp(
    [...getCookieArgs(), '--dump-single-json', '--flat-playlist', '--no-download', '--', url],
    INFO_TIMEOUT_MS,
  );
  return parseUrlInfo(output);
}

/**
 * Search YouTube using yt-dlp
 */
export async function searchYouTube(query: string, maxResults: number = 10): Promise<YouTubeSearchResult[]> {
  const output = await runYtDlp(
    [...getCookieArgs(), "--dump-json", "--flat-playlist", "--no-download", "--", `ytsearch${maxResults}:${query}`],
    INFO_TIMEOUT_MS,
  );

  try {
    // yt-dlp outputs one JSON object per line
    return output
      .trim()
      .split("\n")
      .filter(Boolean)
      .map((line) => {
        const parsed = JSON.parse(line);
        return {
          id: parsed.id,
          title: parsed.title || "Unknown",
          artist: parsed.uploader || parsed.channel || "Unknown",
          duration: parsed.duration || 0,
          thumbnail: parsed.thumbnails?.[0]?.url || "",
        };
      });
  } catch {
    return [];
  }
}
