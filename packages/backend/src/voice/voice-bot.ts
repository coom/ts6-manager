import { EventEmitter } from 'events';
import { randomBytes } from 'crypto';
import { Ts3Client, type Ts3ClientOptions, generateIdentity, type IdentityData, buildCommand } from './tslib/index.js';
import { AudioPipeline, FRAME_MS, BYTES_PER_FRAME } from './audio/pipeline.js';
import { PlayQueue, type QueueItem } from './playlist/queue.js';
import { fetchIcyMetadata } from './audio/icy-metadata.js';
import { StreamSignaling, type ActiveStream, type SignalingMessage } from './streaming/stream-signaling.js';
import { SidecarClient } from './streaming/sidecar-client.js';
import { SidecarProcess, type SidecarConfig } from './streaming/sidecar-process.js';
import { STREAM_PRESETS, DEFAULT_PRESET, type VideoViewerInfo, type VideoStreamStatus } from './streaming/types.js';
import { getCookieArgs, runYtDlp, assertSafeUrl } from './audio/youtube.js';
import { validateUrl } from '../utils/url-validator.js';

/** Resolve a YouTube/yt-dlp-compatible URL to a direct stream URL */
async function resolveVideoUrl(url: string, maxHeight: number = 720): Promise<string> {
  assertSafeUrl(url);

  // Only resolve YouTube and other yt-dlp-supported sites
  if (!url.includes('youtube.com/') && !url.includes('youtu.be/') && !url.includes('twitch.tv/')) {
    // Anything else goes straight to the sidecar's ffmpeg, so apply the same
    // SSRF guard the radio path uses before handing a URL to a fetcher.
    const check = await validateUrl(url, { allowedProtocols: ['http:', 'https:'] });
    if (!check.valid) {
      throw new Error(`Video source blocked: ${check.error}`);
    }
    return url;
  }

  // Request best combined format (video+audio) up to the target height.
  // runYtDlp adds the cookie args' siblings (timeout, full stderr logging);
  // normal CPU priority — the user is waiting for the stream to start.
  const formatFilter = `best[height<=${maxHeight}][ext=mp4]/best[height<=${maxHeight}]/best[ext=mp4]/best`;
  const stdout = await runYtDlp([
    ...getCookieArgs(),
    '-f', formatFilter,
    '--no-playlist',
    '-g',  // print direct URL only
    '--',  // nothing past this point is parsed as an option
    url,
  ], 60_000, { lowPriority: false });

  // yt-dlp -g returns the direct URL(s), take the first one
  const directUrl = stdout.trim().split('\n')[0];
  if (!directUrl) {
    throw new Error('yt-dlp returned no URL');
  }
  console.log(`[VideoResolve] Resolved: ${url.substring(0, 60)}... → direct URL`);
  return directUrl;
}

export type VoiceBotStatus = 'stopped' | 'starting' | 'connected' | 'playing' | 'paused' | 'error';

export interface PlaybackProgress {
  position: number;  // seconds
  duration: number;  // seconds
}

export interface VoiceBotConfig {
  id: number;
  serverConfigId: number;
  name: string;
  serverHost: string;
  serverPort: number;
  nickname: string;
  serverPassword?: string;
  defaultChannel?: string;
  channelPassword?: string;
  volume: number; // 0-100
  identity?: IdentityData;
  sidecarBinaryPath?: string;
  sidecarPort?: number;
  streamPreset?: string;
}

export class VoiceBot extends EventEmitter {
  private client: Ts3Client;
  private pipeline: AudioPipeline;
  readonly queue: PlayQueue;
  private config: VoiceBotConfig;
  private _status: VoiceBotStatus = 'stopped';
  private _lastError: string = '';
  private identity: IdentityData | null = null;
  private playbackTimer: ReturnType<typeof setTimeout> | null = null;
  private _nowPlaying: QueueItem | null = null;

  // File playback state (streamed: ffmpeg decodes as we consume)
  private loopEpoch: number = 0;       // tick-loop lifetime (bumped by clearTimer)
  private streamEpoch: number = 0;     // ffmpeg process lifetime (bumped when a stream is replaced)
  private fileStdout: import('stream').Readable | null = null;
  private fileDecodeDone: boolean = false;
  private framesSent: number = 0;
  private seekOffsetSec: number = 0;

  private lastVoiceSendAt = 0;       // performance.now() timestamp
  private lastVoiceLogAt = 0;        // rate limit logs

  private statWindowStart = 0;
  private statCount = 0;
  private statDtSum = 0;
  private statDtMin = Number.POSITIVE_INFINITY;
  private statDtMax = 0;

  // Streaming state (radio)
  private _isStreaming: boolean = false;
  private streamKill: (() => void) | null = null;
  private streamChunks: Buffer[] = [];
  private streamChunksSize: number = 0;
  private streamStartTime: number = 0;

  // Nickname "now playing" state
  private _originalNickname: string;

  // ICY metadata polling (radio)
  private icyPollTimer: ReturnType<typeof setInterval> | null = null;
  private lastStreamTitle: string = '';

  // Reconnect: distinguishes manual stop from unexpected disconnect
  private _manuallyStopped: boolean = false;

  // Optional tap on encoded opus frames (e.g. Discord voice relay). The bot
  // itself knows nothing about the consumer.
  private frameSink: ((opusFrame: Buffer) => void) | null = null;

  // Video streaming state
  private signaling: StreamSignaling | null = null;
  private sidecarProc: SidecarProcess | null = null;
  private sidecarHttp: SidecarClient | null = null;
  private _videoStreaming: boolean = false;
  private _activeStreamId: string | null = null;
  private _videoSource: string | null = null;
  private _videoPreset: string = DEFAULT_PRESET;
  private _videoFramerate: number = STREAM_PRESETS[DEFAULT_PRESET]?.framerate ?? 30;
  private _videoBitrate: string = STREAM_PRESETS[DEFAULT_PRESET]?.bitrate ?? '2500k';
  private _videoStartedAt: number | null = null;
  private _viewers: Map<number, VideoViewerInfo> = new Map();

  constructor(config: VoiceBotConfig) {
    super();
    this.config = config;
    this._originalNickname = config.nickname;
    this.client = new Ts3Client();
    this.pipeline = new AudioPipeline();
    this.queue = new PlayQueue();

    this.client.on('error', (err) => {
      this._status = 'error';
      this.emit('error', err);
      this.emit('statusChange', this._status);
    });

    this.client.on('disconnected', () => {
      this.stopIcyPolling();
      this.stopPlayback();
      this._status = 'stopped';
      this._nowPlaying = null;
      this.emit('statusChange', this._status);
      this.emit('disconnected');
    });

    this.client.on('ts3error', (params: Record<string, string>) => {
      const id = parseInt(params.id || '0');
      const msg = params.msg || 'unknown error';
      this._lastError = `TS3 error ${id}: ${msg}`;
      // Fatal errors that should not trigger reconnect
      // 2568 = invalid password, 3329 = banned, 1796 = max clients reached
      if (id === 2568 || id === 3329 || id === 1796) {
        this._status = 'error';
        this.emit('statusChange', this._status);
        this.emit('fatalError', this._lastError);
      }
    });

    this.client.on('command', (cmd) => {
      this.emit('command', cmd);
    });

    this.client.on('textMessage', (data: Record<string, string>) => {
      this.emit('textMessage', data);
    });
  }

  get id(): number {
    return this.config.id;
  }

  get status(): VoiceBotStatus {
    return this._status;
  }

  get nowPlaying(): QueueItem | null {
    return this._nowPlaying;
  }

  get isStreaming(): boolean {
    return this._isStreaming;
  }

  get manuallyStopped(): boolean {
    return this._manuallyStopped;
  }

  get playbackProgress(): PlaybackProgress | null {
    if (!this._nowPlaying) return null;
    if (this._isStreaming) {
      return {
        position: (Date.now() - this.streamStartTime) / 1000,
        duration: 0, // Live stream — no known duration
      };
    }
    return {
      position: this.seekOffsetSec + (this.framesSent * FRAME_MS) / 1000,
      duration: this._nowPlaying.duration ?? 0,
    };
  }

  get lastError(): string {
    return this._lastError;
  }

  get ts3ClientId(): number {
    return this.client.getClientId();
  }

  sendTextMessage(targetClid: number, msg: string): void {
    const cmd = buildCommand('sendtextmessage', {
      targetmode: 1,
      target: targetClid,
      msg,
    });
    this.client.sendCommand(cmd);
  }

  /** Send a message to the bot's current channel (targetmode 2). */
  sendChannelMessage(msg: string): void {
    const cmd = buildCommand('sendtextmessage', {
      targetmode: 2,
      target: this.client.getChannelId(),
      msg,
    });
    this.client.sendCommand(cmd);
  }

  get currentConfig(): VoiceBotConfig {
    return { ...this.config };
  }

  updateConfig(partial: Partial<VoiceBotConfig>): void {
    Object.assign(this.config, partial);
    if (partial.nickname) this._originalNickname = partial.nickname;
  }

  /** Update the TS3 nickname to show what's playing. Max 30 chars. */
  private updateNowPlayingNickname(title: string): void {
    if (this._status === 'stopped') return;
    const prefix = this._originalNickname;
    const sep = ' \u266A '; // ♪
    const maxLen = 30;
    let nick = prefix + sep + title;
    if (nick.length > maxLen) {
      const available = maxLen - prefix.length - sep.length - 1; // -1 for …
      nick = prefix + sep + (available > 0 ? title.substring(0, available) + '\u2026' : '\u2026');
    }
    try {
      this.client.sendCommand(buildCommand('clientupdate', { client_nickname: nick }));
    } catch { }
  }

  /** Reset TS3 nickname to original. */
  private resetNickname(): void {
    if (this._status === 'stopped') return;
    try {
      this.client.sendCommand(buildCommand('clientupdate', { client_nickname: this._originalNickname }));
    } catch { }
  }

  /** Start polling ICY metadata for a radio stream. */
  private startIcyPolling(streamUrl: string): void {
    this.stopIcyPolling();
    this.lastStreamTitle = '';

    // Immediate first fetch
    this.fetchAndUpdateIcy(streamUrl);

    this.icyPollTimer = setInterval(() => {
      this.fetchAndUpdateIcy(streamUrl);
    }, 15000);
  }

  private async fetchAndUpdateIcy(streamUrl: string): Promise<void> {
    try {
      const title = await fetchIcyMetadata(streamUrl);
      if (!title || title === this.lastStreamTitle || !this._nowPlaying) return;
      this.lastStreamTitle = title;

      // Parse "Artist - Title" format
      const dashIdx = title.indexOf(' - ');
      if (dashIdx > 0) {
        this._nowPlaying.artist = title.substring(0, dashIdx).trim();
        this._nowPlaying.title = title.substring(dashIdx + 3).trim();
      } else {
        this._nowPlaying.title = title;
      }

      this.updateNowPlayingNickname(title);
      this.emit('metadataChange', this._nowPlaying);
    } catch { }
  }

  private stopIcyPolling(): void {
    if (this.icyPollTimer) {
      clearInterval(this.icyPollTimer);
      this.icyPollTimer = null;
    }
    this.lastStreamTitle = '';
  }

  async start(): Promise<void> {
    if (this._status === 'connected' || this._status === 'playing' || this._status === 'paused') {
      throw new Error('Bot is already running');
    }

    this._manuallyStopped = false;
    this._status = 'starting';
    this.emit('statusChange', this._status);

    this.identity = this.config.identity ?? generateIdentity(8);

    const opts: Ts3ClientOptions = {
      host: this.config.serverHost,
      port: this.config.serverPort,
      identity: this.identity,
      nickname: this.config.nickname,
      serverPassword: this.config.serverPassword,
      defaultChannel: this.config.defaultChannel,
      channelPassword: this.config.channelPassword,
    };

    await this.client.connect(opts);
    this._status = 'connected';
    this.emit('statusChange', this._status);
    this.emit('connected');
  }

  async stop(): Promise<void> {
    this._manuallyStopped = true;
    this.stopIcyPolling();
    this.resetNickname();
    this.stopPlayback();
    this._nowPlaying = null;
    // Stop video stream if active
    if (this._videoStreaming) {
      await this.stopVideoStream();
    }
    this.client.disconnect();
  }

  /** Force-close the underlying socket if still open, without triggering reconnect */
  ensureDisconnected(): void {
    this.client.forceClose();
  }

  async restart(): Promise<void> {
    await this.stop();
    await new Promise<void>((resolve) => {
      const check = () => {
        if (this._status === 'stopped') resolve();
        else setTimeout(check, 100);
      };
      setTimeout(check, 600);
    });
    await this.start();
  }

  async play(item: QueueItem): Promise<void> {
    if (this._status !== 'connected' && this._status !== 'playing' && this._status !== 'paused') {
      throw new Error('Bot is not connected');
    }

    this.stopIcyPolling();
    this.stopPlayback();
    this._nowPlaying = item;
    this._status = 'playing';
    this.emit('statusChange', this._status);
    this.emit('nowPlaying', item);
    this.updateNowPlayingNickname(item.title);

    try {
      // Streamed playback: ffmpeg decodes the file as we consume it.
      // First audio in ~200ms and constant memory, instead of decoding the
      // entire track to PCM in RAM up front.
      this.startFileStream(item, 0);
      this.startFilePlaybackLoop(item);
    } catch (err) {
      this._status = 'connected';
      this._nowPlaying = null;
      this.emit('statusChange', this._status);
      throw err;
    }
  }

  /** Spawn the decode ffmpeg for a file at the given offset and wire its events. */
  private startFileStream(item: QueueItem, startSeconds: number): void {
    const stream = this.pipeline.toPcmFileStream(item.filePath, startSeconds);
    const sEpoch = ++this.streamEpoch;

    this.streamKill = stream.kill;
    this.fileStdout = stream.stdout;
    this.streamChunks = [];
    this.streamChunksSize = 0;
    this.fileDecodeDone = false;
    this.framesSent = 0;
    this.seekOffsetSec = startSeconds;

    stream.stdout.on('data', (chunk: Buffer) => {
      if (sEpoch !== this.streamEpoch) return;
      this.streamChunks.push(chunk);
      this.streamChunksSize += chunk.length;
    });

    stream.process.on('close', (code) => {
      if (sEpoch !== this.streamEpoch) return;
      // The tick loop drains the remaining buffer, then ends the track
      this.fileDecodeDone = true;
      if (code !== 0 && code !== null) {
        console.error(`[VoiceBot] Decode ffmpeg exited with code ${code} for ${item.filePath}`);
      }
    });

    stream.process.on('error', (err) => {
      if (sEpoch !== this.streamEpoch) return;
      this.fileDecodeDone = true;
      this.emit('error', err);
    });
  }

  /** Drain whatever PCM remains (< one frame) into a zero-padded final frame. */
  private takeRemainderPadded(): Buffer | null {
    if (this.streamChunksSize === 0) return null;
    const out = Buffer.alloc(BYTES_PER_FRAME, 0);
    let offset = 0;
    while (this.streamChunks.length > 0) {
      const head = this.streamChunks.shift()!;
      head.copy(out, offset);
      offset += head.length;
    }
    this.streamChunksSize = 0;
    return out;
  }

  async playStream(item: QueueItem): Promise<void> {
    if (this._status !== 'connected' && this._status !== 'playing' && this._status !== 'paused') {
      throw new Error('Bot is not connected');
    }
    if (!item.streamUrl) {
      throw new Error('No streamUrl provided');
    }

    this.stopIcyPolling();
    this.stopPlayback();
    this._nowPlaying = item;
    this._isStreaming = true;
    this._status = 'playing';
    this.streamStartTime = Date.now();
    this.emit('statusChange', this._status);
    this.emit('nowPlaying', item);
    this.updateNowPlayingNickname(item.title);
    this.startIcyPolling(item.streamUrl);

    try {
      const stream = await this.pipeline.toPcmStream(item.streamUrl);
      this.streamKill = stream.kill;
      this.streamChunks = [];
      this.streamChunksSize = 0;

      const epoch = ++this.loopEpoch;

      stream.stdout.on('data', (chunk: Buffer) => {
        if (epoch !== this.loopEpoch) return;
        this.streamChunks.push(chunk);
        this.streamChunksSize += chunk.length;
      });

      stream.process.on('close', () => {
        if (epoch !== this.loopEpoch) return;
        this.client.sendVoiceStop();
        this._isStreaming = false;
        this.streamKill = null;
        this._nowPlaying = null;
        this._status = 'connected';
        this.emit('statusChange', this._status);
        this.emit('trackEnd', item);
      });

      stream.process.on('error', (err) => {
        if (epoch !== this.loopEpoch) return;
        this._isStreaming = false;
        this.streamKill = null;
        this._status = 'error';
        this.emit('error', err);
        this.emit('statusChange', this._status);
      });

      let nextDue = performance.now() + 200; // initial buffer delay

      const tick = () => {
        if (epoch !== this.loopEpoch) return;

        const now = performance.now();

        // If we're early, wait until the next due time
        if (now < nextDue) {
          this.playbackTimer = setTimeout(tick, Math.max(1, nextDue - now));
          return;
        }

        // If we're behind, resync clock (no bursts)
        const lagMs = now - nextDue;
        if (lagMs >= FRAME_MS) {
          nextDue = now + FRAME_MS;
        }

        // Send exactly one frame if available
        const frame = this.takeFromStreamChunks(BYTES_PER_FRAME);
        if (frame) {
          if (!this.encodeAndSend(frame)) return;
        }

        // Next slot
        nextDue += FRAME_MS;

        // If we fell way behind, resync to avoid long "catch-up"
        if (now - nextDue > 5 * FRAME_MS) {
          nextDue = now + FRAME_MS;
        }

        const delay = nextDue - performance.now();

        if (delay > 2) {
          this.playbackTimer = setTimeout(tick, delay);
        } else {
          setImmediate(tick);
        }
      };

      this.playbackTimer = setTimeout(tick, 200);
    } catch (err) {
      this._isStreaming = false;
      this.streamKill = null;
      this._status = 'connected';
      this._nowPlaying = null;
      this.emit('statusChange', this._status);
      throw err;
    }
  }

  pause(): void {
    if (this._status !== 'playing') return;
    if (this._isStreaming) return; // live radio cannot pause
    this.clearTimer();
    // Pipe backpressure idles the decode ffmpeg at 0 CPU while paused
    this.fileStdout?.pause();
    this.client.sendVoiceStop();
    this._status = 'paused';
    this.emit('statusChange', this._status);
  }

  resume(): void {
    if (this._status !== 'paused') return;
    const item = this._nowPlaying;
    if (!item) return;
    this._status = 'playing';
    this.emit('statusChange', this._status);
    this.fileStdout?.resume();
    this.startFilePlaybackLoop(item);
  }

  seek(seconds: number): void {
    if (this._status !== 'playing' && this._status !== 'paused') return;
    if (this._isStreaming) return; // live radio cannot seek
    const item = this._nowPlaying;
    if (!item) return;

    const target = Math.max(0, item.duration ? Math.min(seconds, Math.max(0, item.duration - 1)) : seconds);

    // Replace the decode ffmpeg with one starting at the target position
    this.clearTimer();
    if (this.streamKill) {
      this.streamKill();
      this.streamKill = null;
    }
    this.startFileStream(item, target);

    if (this._status === 'playing') {
      this.startFilePlaybackLoop(item);
    } else {
      // Stay paused: keep the new stream idle until resume()
      this.fileStdout?.pause();
    }
  }

  setVolume(volume: number): void {
    this.config.volume = Math.max(0, Math.min(100, volume));
    this.emit('volumeChange', this.config.volume);
  }

  skip(): void {
    this.stopIcyPolling();
    this.stopPlayback();
    this._nowPlaying = null;
    this._status = 'connected';
    this.emit('statusChange', this._status);

    const next = this.queue.next();
    if (next) {
      this.play(next).catch((err) => this.emit('error', err));
    } else {
      this.resetNickname();
    }
  }

  previous(): void {
    this.stopIcyPolling();
    this.stopPlayback();
    this._nowPlaying = null;
    this._status = 'connected';
    this.emit('statusChange', this._status);

    const prev = this.queue.previous();
    if (prev) {
      this.play(prev).catch((err) => this.emit('error', err));
    } else {
      this.resetNickname();
    }
  }

  stopAudio(): void {
    this.stopIcyPolling();
    this.stopPlayback();
    this.client.sendVoiceStop();
    this._nowPlaying = null;
    this.resetNickname();
    if (this._status === 'playing' || this._status === 'paused') {
      this._status = 'connected';
      this.emit('statusChange', this._status);
    }
  }

  private takeFromStreamChunks(n: number): Buffer | null {
    if (this.streamChunksSize < n) return null;

    const out = Buffer.allocUnsafe(n);
    let offset = 0;

    while (offset < n) {
      const head = this.streamChunks[0];
      const need = n - offset;

      if (head.length <= need) {
        head.copy(out, offset);
        offset += head.length;
        this.streamChunks.shift();
      } else {
        head.copy(out, offset, 0, need);
        this.streamChunks[0] = head.subarray(need);
        offset += need;
      }
    }

    this.streamChunksSize -= n;
    return out;
  }

  private sendVoiceFrame(opusFrame: Buffer): void {
    const now = performance.now();
    const dt = this.lastVoiceSendAt ? (now - this.lastVoiceSendAt) : 0;
    this.lastVoiceSendAt = now;

    const VOICE_DEBUG = process.env.VOICE_DEBUG === '1';

    if (VOICE_DEBUG) {
      // 1s stats
      if (!this.statWindowStart) this.statWindowStart = now;
      if (dt > 0) {
        this.statCount++;
        this.statDtSum += dt;
        this.statDtMin = Math.min(this.statDtMin, dt);
        this.statDtMax = Math.max(this.statDtMax, dt);
      }

      if (now - this.statWindowStart >= 1000) {
        const avg = this.statCount ? (this.statDtSum / this.statCount) : 0;
        console.log(
          `[voice] rate=${this.statCount}/s avg=${avg.toFixed(1)}ms min=${this.statDtMin.toFixed(1)} max=${this.statDtMax.toFixed(1)} streaming=${this._isStreaming}`
        );
        this.statWindowStart = now;
        this.statCount = 0;
        this.statDtSum = 0;
        this.statDtMin = Number.POSITIVE_INFINITY;
        this.statDtMax = 0;
      }
    }

    this.client.sendVoice(opusFrame);

    if (this.frameSink) {
      try { this.frameSink(opusFrame); } catch { /* relay must never break TS playback */ }
    }
  }

  setFrameSink(sink: ((opusFrame: Buffer) => void) | null): void {
    this.frameSink = sink;
  }

  /**
   * Stop the current track after an unrecoverable error raised inside the
   * playback timer. Without this the throw would escape the setTimeout/
   * setImmediate callback as an uncaughtException and take down the whole
   * backend — a single bad frame (e.g. the voice socket dropping mid-track)
   * must only end the track, not crash the process.
   */
  private failPlayback(err: Error): void {
    console.error(`[VoiceBot] Playback frame error, stopping track: ${err?.message ?? err}`);
    this.loopEpoch++;   // invalidate any pending ticks
    this.streamEpoch++;
    this.clearTimer();
    try { this.streamKill?.(); } catch { /* already gone */ }
    this.streamKill = null;
    this.stopIcyPolling();
    this._isStreaming = false;
    this._nowPlaying = null;
    this._status = 'connected';
    try { this.client.sendVoiceStop(); } catch { /* connection may be down */ }
    this.emit('error', err);
    this.emit('statusChange', this._status);
  }

  /** Encode + send one PCM frame, guarding the only calls in the timer that can
   *  realistically throw (native opus / UDP voice). Returns false on failure
   *  (the track has been stopped) so the tick can bail out. */
  private encodeAndSend(pcmFrame: Buffer): boolean {
    try {
      this.sendVoiceFrame(this.pipeline.encodeFrame(pcmFrame, this.config.volume));
      return true;
    } catch (err) {
      this.failPlayback(err as Error);
      return false;
    }
  }

  private startFilePlaybackLoop(item: QueueItem): void {
    const epoch = ++this.loopEpoch;

    // "Audio clock": next frame is due at this timestamp (small prebuffer
    // so the decode ffmpeg gets a head start)
    let nextDue = performance.now() + 200;

    const tick = () => {
      if (epoch !== this.loopEpoch) return;

      const now = performance.now();

      // If we're early, wait until the next due time
      if (now < nextDue) {
        this.playbackTimer = setTimeout(tick, Math.max(1, nextDue - now));
        return;
      }

      // If we're behind, resync clock (never burst-send)
      if (now - nextDue >= FRAME_MS) {
        nextDue = now + FRAME_MS;
      }

      // Send exactly ONE frame (if available)
      const frame = this.takeFromStreamChunks(BYTES_PER_FRAME);
      if (frame) {
        if (!this.encodeAndSend(frame)) return;
        this.framesSent++;
      } else if (this.fileDecodeDone) {
        // Decode finished and buffer exhausted: flush the final partial
        // frame (zero-padded), then end the track
        const last = this.takeRemainderPadded();
        if (last) {
          if (!this.encodeAndSend(last)) return;
          this.framesSent++;
        }
        this.endOfTrack(item);
        return;
      }
      // else: decode momentarily slower than playback — silent gap, keep pacing

      // Schedule next tick for the next 20ms slot
      nextDue += FRAME_MS;

      // If we fell way behind, resync to avoid long "catch-up"
      if (now - nextDue > 5 * FRAME_MS) {
        nextDue = now + FRAME_MS;
      }

      const delay = nextDue - performance.now();

      if (delay > 2) {
        this.playbackTimer = setTimeout(tick, delay);
      } else {
        setImmediate(tick);
      }
    };

    this.playbackTimer = setTimeout(tick, 0);
  }

  private endOfTrack(finishedItem: QueueItem): void {
    this.client.sendVoiceStop();
    this.clearTimer();

    // Release the decode process and its buffers
    this.streamEpoch++;
    if (this.streamKill) {
      this.streamKill();
      this.streamKill = null;
    }
    this.fileStdout = null;
    this.fileDecodeDone = false;
    this.streamChunks = [];
    this.streamChunksSize = 0;

    const finished = this._nowPlaying ?? finishedItem;
    this._nowPlaying = null;
    this._status = 'connected';
    this.emit('statusChange', this._status);
    this.emit('trackEnd', finished);

    // Track repeat
    if (this.queue.repeat === 'track' && finished) {
      this.play(finished).catch((err) => this.emit('error', err));
      return;
    }

    const next = this.queue.next();
    if (next) this.play(next).catch((err) => this.emit('error', err));
    else this.resetNickname();
  }

  private clearTimer(): void {
    this.loopEpoch++;
    if (this.playbackTimer) {
      clearTimeout(this.playbackTimer);
      this.playbackTimer = null;
    }
  }

  private stopPlayback(): void {
    this.clearTimer();
    this.streamEpoch++; // orphan any pending stdout/close handlers

    // Kill decode/streaming FFmpeg if active
    if (this.streamKill) {
      this.streamKill();
      this.streamKill = null;
    }
    this._isStreaming = false;
    this.streamChunks = [];
    this.streamChunksSize = 0;
    this.fileStdout = null;
    this.fileDecodeDone = false;
    this.framesSent = 0;
    this.seekOffsetSec = 0;
  }

  // ─── Video Streaming ────────────────────────────────────────

  get videoStreaming(): boolean {
    return this._videoStreaming;
  }

  get videoStreamStatus(): VideoStreamStatus {
    return {
      streaming: this._videoStreaming,
      streamId: this._activeStreamId,
      source: this._videoSource,
      preset: this._videoPreset,
      framerate: this._videoFramerate,
      bitrate: this._videoBitrate,
      startedAt: this._videoStartedAt,
      viewerCount: this._viewers.size,
      viewers: Array.from(this._viewers.values()),
      sidecar: null,
    };
  }

  /** Start video streaming to TS6 via WebRTC */
  async startVideoStream(source: string, preset?: string, framerate?: number, bitrate?: string): Promise<void> {
    if (this._status !== 'connected' && this._status !== 'playing' && this._status !== 'paused') {
      throw new Error('Bot is not connected');
    }
    if (this._videoStreaming) {
      throw new Error('Video stream already active');
    }

    const sidecarBinary = this.config.sidecarBinaryPath || process.env.SIDECAR_BINARY_PATH || 'sidecar';
    const sidecarPort = this.config.sidecarPort || 9800;
    this._videoPreset = preset ?? this.config.streamPreset ?? DEFAULT_PRESET;
    const presetConfig = STREAM_PRESETS[this._videoPreset] || STREAM_PRESETS[DEFAULT_PRESET];
    const effectiveFramerate = framerate && framerate > 0
      ? framerate
      : presetConfig.framerate;
    const effectiveBitrate = bitrate?.trim()
      ? bitrate.trim()
      : presetConfig.bitrate;

    this._videoFramerate = effectiveFramerate;
    this._videoBitrate = effectiveBitrate;

    // Check if sidecar URL is set (Docker mode — sidecar runs as separate container)
    const sidecarUrl = process.env.SIDECAR_URL;

    if (sidecarUrl) {
      // Docker mode: the sidecar is a separate container, so the shared secret
      // has to be configured on both sides. The sidecar refuses to start
      // without it; fail here with a message that names the variable.
      if (!process.env.SIDECAR_TOKEN) {
        throw new Error('SIDECAR_TOKEN must be set when SIDECAR_URL is used (shared secret for the media API)');
      }
      this.sidecarHttp = new SidecarClient(sidecarUrl);
    } else {
      // Local mode: spawn the sidecar binary. Mint a per-spawn token so the
      // media API is authenticated with no configuration required.
      const sidecarToken = process.env.SIDECAR_TOKEN || randomBytes(32).toString('hex');
      const sidecarConfig: SidecarConfig = {
        binaryPath: sidecarBinary,
        token: sidecarToken,
        port: sidecarPort,
        videoBitrate: effectiveBitrate,
        videoResolution: { width: presetConfig.width, height: presetConfig.height },
        videoFramerate: effectiveFramerate,
      };

      this.sidecarProc = new SidecarProcess(sidecarConfig);
      this.sidecarProc.on('exited', (code: number | null) => {
        console.log(`[VoiceBot ${this.config.id}] Sidecar exited (code=${code})`);
        if (this._videoStreaming) {
          this._videoStreaming = false;
          this._activeStreamId = null;
          this._viewers.clear();
          this.emit('videoStreamStopped');
          this.emit('statusChange', this._status);
        }
      });
      try {
        this.sidecarProc.start();
      } catch (err: any) {
        this.sidecarProc = null;
        throw new Error(`Failed to start sidecar: ${err.message}`, { cause: err });
      }
      this.sidecarHttp = new SidecarClient(sidecarPort, sidecarToken);
    }

    // Wait for sidecar to be healthy
    await this.sidecarHttp.waitHealthy();
    console.log(`[VoiceBot ${this.config.id}] Sidecar ready`);

    // Setup stream signaling on the TS3 client
    this.signaling = new StreamSignaling(this.client);
    this.setupSignalingListeners();
    this.signaling.registerStreamNotifications();

    // Wait for server to confirm stream
    const streamPromise = new Promise<ActiveStream>((resolve, reject) => {
      const timeout = setTimeout(() => reject(new Error('setupstream timeout')), 10000);
      const handler = (stream: ActiveStream) => {
        if (stream.clid === this.client.getClientId()) {
          clearTimeout(timeout);
          this.signaling!.removeListener('streamStarted', handler);
          resolve(stream);
        }
      };
      this.signaling!.on('streamStarted', handler);
    });

    // Send setupstream command
    this.signaling.sendSetupStream({
      name: `${this.config.nickname} Stream`,
      type: 3,
      bitrate: 4608,
      accessibility: 1,
      mode: 1,
      viewerLimit: 0,
      audio: true,
    });

    const stream = await streamPromise;
    this._activeStreamId = stream.id;
    this._videoStreaming = true;
    this._videoSource = source;
    this._videoStartedAt = Date.now();

    // Resolve YouTube/streaming URLs via yt-dlp, then start ffmpeg
    const resolvedSource = await resolveVideoUrl(source, presetConfig.height);
    await this.sidecarHttp.setSource(
      resolvedSource,
      presetConfig.width,
      presetConfig.height,
      effectiveFramerate,
      effectiveBitrate,
    );

    console.log(`[VoiceBot ${this.config.id}] Video stream started: ${stream.id}, source: ${source}`);
    this.emit('videoStreamStarted', { streamId: stream.id, source, preset: this._videoPreset });
    this.emit('statusChange', this._status);
  }

  /** Stop video streaming */
  async stopVideoStream(): Promise<void> {
    if (!this._videoStreaming) return;

    // Remove all viewers from TS6 stream first
    if (this.signaling && this._activeStreamId) {
      for (const [clid] of this._viewers) {
        this.signaling.sendRemoveClient(clid, this._activeStreamId);
      }
    }

    // Stop ffmpeg and close WebRTC peers
    try { await this.sidecarHttp?.stopSource(); } catch { /* ignore */ }
    for (const [clid] of this._viewers) {
      try { await this.sidecarHttp?.closePeer(String(clid)); } catch { /* ignore */ }
    }
    this._viewers.clear();

    // Stop TS6 stream
    if (this.signaling && this._activeStreamId) {
      console.log(`[VoiceBot ${this.config.id}] Sending stopstream: ${this._activeStreamId}`);
      this.signaling.sendStreamStop(this._activeStreamId);
    }

    // Wait for the stopstream command to be sent and ACKed over UDP
    await new Promise((r) => setTimeout(r, 1000));

    // Stop sidecar process (only in local mode)
    if (this.sidecarProc) {
      await this.sidecarProc.stop();
      this.sidecarProc = null;
    }

    this._activeStreamId = null;
    this._videoSource = null;
    this._videoStreaming = false;
    this._videoStartedAt = null;
    this.signaling?.dispose();
    this.signaling = null;

    console.log(`[VoiceBot ${this.config.id}] Video stream stopped`);
    this.emit('videoStreamStopped');
    this.emit('statusChange', this._status);
  }

  /** Change video source while streaming */
  async setVideoSource(source: string): Promise<void> {
    if (!this._videoStreaming || !this.sidecarHttp) {
      throw new Error('No active video stream');
    }
    this._videoSource = source;
    const currentPreset = STREAM_PRESETS[this._videoPreset] || STREAM_PRESETS[DEFAULT_PRESET];
    const resolvedSource = await resolveVideoUrl(source, currentPreset.height);

    await this.sidecarHttp.setSource(
      resolvedSource,
      currentPreset.width,
      currentPreset.height,
      this._videoFramerate,
      this._videoBitrate,
    );
    console.log(`[VoiceBot ${this.config.id}] Video source changed: ${source}`);
    this.emit('videoSourceChanged', source);
  }

  /** Kick a viewer from the video stream */
  async kickVideoViewer(clid: number): Promise<void> {
    if (!this._videoStreaming || !this.signaling || !this._activeStreamId) {
      throw new Error('No active video stream');
    }
    try { await this.sidecarHttp?.closePeer(String(clid)); } catch { /* ignore */ }
    this.signaling.sendRemoveClient(clid, this._activeStreamId);
    this._viewers.delete(clid);
    this.emit('videoViewerLeft', clid);
  }

  /** Get WebRTC offer for WebUI preview player */
  async getWebRtcOffer(): Promise<{ sdp: string } | null> {
    if (!this._videoStreaming || !this.sidecarHttp) return null;
    return this.sidecarHttp.createPeer('webui-preview');
  }

  /** Set WebRTC answer from WebUI preview player */
  async setWebRtcAnswer(sdp: string): Promise<void> {
    if (!this.sidecarHttp) throw new Error('No sidecar');
    await this.sidecarHttp.setAnswer('webui-preview', sdp);
  }

  /** Add ICE candidate from WebUI preview player */
  async addWebRtcIceCandidate(candidate: string, sdpMid: string, sdpMLineIndex: number): Promise<void> {
    if (!this.sidecarHttp) throw new Error('No sidecar');
    await this.sidecarHttp.addIceCandidate('webui-preview', candidate, sdpMid, sdpMLineIndex);
  }

  private setupSignalingListeners(): void {
    if (!this.signaling) return;

    this.signaling.on('signalingMessage', (msg: SignalingMessage) => {
      this.handleSignalingMessage(msg);
    });

    this.signaling.on('joinStreamRequest', (params: Record<string, string>) => {
      const viewerClid = parseInt(params.clid) || 0;
      const streamId = params.id || this._activeStreamId;
      if (!streamId || !viewerClid) return;
      console.log(`[VoiceBot ${this.config.id}] Viewer join request: clid=${viewerClid}`);
      this.handleViewerJoin(viewerClid, streamId);
    });

    this.signaling.on('streamClientLeft', (params: Record<string, string>) => {
      const clid = parseInt(params.clid) || 0;
      if (this._viewers.has(clid)) {
        console.log(`[VoiceBot ${this.config.id}] Viewer left: clid=${clid}`);
        this.sidecarHttp?.closePeer(String(clid)).catch(() => { });
        this._viewers.delete(clid);
        this.emit('videoViewerLeft', clid);
      }
    });
  }

  private async handleSignalingMessage(msg: SignalingMessage): Promise<void> {
    if (!this.sidecarHttp) return;

    switch (msg.type) {
      case 'answer':
        if (msg.sdp && msg.clid) {
          try {
            await this.sidecarHttp.setAnswer(String(msg.clid), msg.sdp);
          } catch (err: any) {
            console.error(`[VoiceBot ${this.config.id}] setAnswer error (clid=${msg.clid}): ${err.message}`);
          }
        }
        break;
      case 'ice_candidate':
        if (msg.candidate && msg.clid) {
          try {
            await this.sidecarHttp.addIceCandidate(
              String(msg.clid),
              msg.candidate,
              msg.sdpMid || '0',
              msg.sdpMlineIndex ?? 0
            );
          } catch (err: any) {
            console.error(`[VoiceBot ${this.config.id}] addIceCandidate error (clid=${msg.clid}): ${err.message}`);
          }
        }
        break;
      case 'reconnect':
        if (msg.clid && this._activeStreamId) {
          console.log(`[VoiceBot ${this.config.id}] Reconnect from clid=${msg.clid}`);
          try { await this.sidecarHttp.closePeer(String(msg.clid)); } catch { /* ignore */ }
          this._viewers.delete(msg.clid);
          await this.handleViewerJoin(msg.clid, this._activeStreamId);
        }
        break;
    }
  }

  private async handleViewerJoin(viewerClid: number, streamId: string): Promise<void> {
    if (!this.sidecarHttp || !this.signaling) return;

    try {
      if (this._viewers.has(viewerClid)) {
        try { await this.sidecarHttp.closePeer(String(viewerClid)); } catch { /* ignore */ }
      }

      const result = await this.sidecarHttp.createPeer(String(viewerClid));

      const viewer: VideoViewerInfo = {
        clid: viewerClid,
        joinedAt: Date.now(),
        iceState: 'new',
      };
      this._viewers.set(viewerClid, viewer);

      this.signaling.sendJoinResponse(viewerClid, streamId, true, result.sdp);
      console.log(`[VoiceBot ${this.config.id}] Viewer accepted: clid=${viewerClid} (${this._viewers.size} total)`);
      this.emit('videoViewerJoined', viewer);
    } catch (err: any) {
      console.error(`[VoiceBot ${this.config.id}] handleViewerJoin error (clid=${viewerClid}): ${err.message}`);
      this._viewers.delete(viewerClid);
    }
  }
}
