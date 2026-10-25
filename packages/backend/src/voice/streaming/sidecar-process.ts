/**
 * Manages the Go sidecar child process lifecycle.
 * Spawns the WebRTC media relay binary and monitors it.
 */

import { spawn, type ChildProcess } from 'child_process';
import { EventEmitter } from 'events';

export interface SidecarConfig {
  binaryPath: string;
  /** Shared secret for the sidecar's HTTP API. The sidecar refuses to start without one. */
  token: string;
  port?: number;
  ffmpegPath?: string;
  stunServers?: string[];
  videoCodec?: 'vp8' | 'vp9' | 'h264';
  videoBitrate?: string;
  videoResolution?: { width: number; height: number };
  videoFramerate?: number;
  audioBitrate?: string;
}

export class SidecarProcess extends EventEmitter {
  private process: ChildProcess | null = null;
  private config: SidecarConfig;

  constructor(config: SidecarConfig) {
    super();
    this.config = config;
  }

  start(): void {
    if (this.process) return;

    const port = this.config.port ?? 9800;
    const env: Record<string, string> = {
      ...(process.env as Record<string, string>),
      SIDECAR_PORT: String(port),
      // Generated per spawn by the caller, so the local media API is never open
      // even when the operator has set no SIDECAR_TOKEN.
      SIDECAR_TOKEN: this.config.token,
    };

    if (this.config.ffmpegPath) env.FFMPEG_PATH = this.config.ffmpegPath;
    if (this.config.stunServers?.length) env.STUN_SERVERS = this.config.stunServers.join(',');
    if (this.config.videoCodec) env.VIDEO_CODEC = this.config.videoCodec;
    if (this.config.videoBitrate) env.VIDEO_BITRATE = this.config.videoBitrate;
    if (this.config.videoResolution) {
      env.VIDEO_WIDTH = String(this.config.videoResolution.width);
      env.VIDEO_HEIGHT = String(this.config.videoResolution.height);
    }
    if (this.config.videoFramerate) env.VIDEO_FRAMERATE = String(this.config.videoFramerate);
    if (this.config.audioBitrate) env.AUDIO_BITRATE = this.config.audioBitrate;

    console.log(`[Sidecar] Starting: ${this.config.binaryPath} (port ${port})`);

    this.process = spawn(this.config.binaryPath, [], {
      env,
      stdio: ['ignore', 'pipe', 'pipe'],
    });

    this.process.stdout?.on('data', (data: Buffer) => {
      const line = data.toString().trim();
      if (line) {
        console.log(`[Sidecar] ${line}`);
        this.emit('stdout', line);
      }
    });

    this.process.stderr?.on('data', (data: Buffer) => {
      const line = data.toString().trim();
      if (line) {
        console.log(`[Sidecar] ${line}`);
        this.emit('stderr', line);
      }
    });

    this.process.on('close', (code) => {
      console.log(`[Sidecar] Exited (code=${code})`);
      this.process = null;
      this.emit('exited', code);
    });

    this.process.on('error', (err) => {
      console.error(`[Sidecar] Process error: ${err.message}`);
      this.process = null;
      // Don't re-emit as unhandled — just log and notify via 'exited'
      this.emit('exited', -1);
    });
  }

  async stop(): Promise<void> {
    if (!this.process) return;

    const proc = this.process;
    this.process = null;

    return new Promise<void>((resolve) => {
      const timeout = setTimeout(() => {
        try { proc.kill('SIGKILL'); } catch { /* ignore */ }
        resolve();
      }, 3000);

      proc.removeAllListeners('close');
      proc.once('close', () => {
        clearTimeout(timeout);
        resolve();
      });

      try { proc.kill('SIGTERM'); } catch { /* ignore */ }
    });
  }

  isRunning(): boolean {
    return this.process !== null;
  }
}
