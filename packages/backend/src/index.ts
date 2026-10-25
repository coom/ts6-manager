import { createApp } from './app.js';
import { createServer, type IncomingMessage } from 'http';
import { WebSocketServer } from 'ws';
import { bindIdentity, type WsIdentity } from './ws/ws-broadcast.js';
import type { JwtPayload } from '@ts6/common';
import { PrismaClient } from '../generated/prisma/index.js';
import { ConnectionPool } from './ts-client/connection-pool.js';
import { BotEngine } from './bot-engine/engine.js';
import { VoiceBotManager } from './voice/voice-bot-manager.js';
import { MusicCommandHandler } from './voice/music-command-handler.js';
import { DiscordBridge } from './discord/discord-bridge.js';
import { ConnectionJournal } from './connection-journal.js';
import { applyTrustProxy, loadTrustProxy } from './routes/settings.routes.js';
import { loadSamlRuntime } from './auth/saml/saml-config.js';
import { config } from './config.js';
import { setYtCookieFile } from './voice/audio/youtube.js';
import { PlaylistImporter } from './voice/playlist-import.js';
import jwt from 'jsonwebtoken';
import fs from 'fs';
import path from 'path';

// Last-resort safety net: a single bot/track glitch, an unawaited promise, or a
// late event must never take the whole backend (serving every user) down. Log
// the full error — including the stack, so the real cause is captured next time
// — and keep running. The audio path additionally guards itself (failPlayback),
// so this is defence in depth, not the primary handler.
process.on('uncaughtException', (err) => {
  console.error('[FATAL] Uncaught exception (kept alive):', err);
});
process.on('unhandledRejection', (reason) => {
  console.error('[FATAL] Unhandled promise rejection (kept alive):', reason);
});

async function main() {
  // config.ts already requires both secrets to be present and long enough,
  // in every environment. What is left to check is that they are not the same
  // value, so a leaked signing key cannot also decrypt stored credentials.
  if (config.encryptionKey === config.jwtSecret) {
    console.error('[FATAL] ENCRYPTION_KEY must be different from JWT_SECRET.');
    process.exit(1);
  }

  // Configure yt-dlp cookie file: env var takes priority, then saved file from data dir
  const cookiePath = process.env.YT_COOKIE_FILE;
  const savedCookiePath = path.resolve('data', 'yt-cookies.txt');
  if (cookiePath && fs.existsSync(cookiePath)) {
    setYtCookieFile(cookiePath);
    console.log(`[yt-dlp] Using cookie file (env): ${cookiePath}`);
  } else if (fs.existsSync(savedCookiePath)) {
    setYtCookieFile(savedCookiePath);
    console.log(`[yt-dlp] Using saved cookie file: ${savedCookiePath}`);
  } else if (cookiePath) {
    console.warn(`[yt-dlp] Cookie file not found: ${cookiePath}`);
  }

  const prisma = new PrismaClient();
  const app = createApp();
  const server = createServer(app);

  // Apply the WebUI-configured reverse-proxy hop count (real client IP from XFF)
  applyTrustProxy(app, await loadTrustProxy(prisma));

  // YouTube/batch downloads run inside the HTTP request; Node's default
  // 5-minute request timeout kills long playlist imports mid-flight while the
  // download loop keeps running server-side (the UI shows an error but songs
  // keep appearing). headersTimeout keeps its default, so slowloris
  // protection is unaffected.
  server.requestTimeout = 0;

  // H3: WebSocket with JWT authentication
  const wss = new WebSocketServer({
    server,
    path: '/ws',
    verifyClient: ({ req }, done) => {
      // Mirrors middleware/auth.ts: assert the token class, then confirm the
      // account is still live. Verifying the signature alone would accept a
      // pre-MFA challenge token and would keep serving a disabled account.
      void (async () => {
        try {
          const wsUrl = new URL(req.url!, `http://${req.headers.host}`);
          const token = wsUrl.searchParams.get('token');
          if (!token) return done(false, 401, 'Missing token');

          const payload = jwt.verify(token, config.jwtSecret, { algorithms: ['HS256'] }) as JwtPayload;
          if (payload.typ !== 'access') return done(false, 401, 'Invalid token');

          const user = await prisma.user.findUnique({
            where: { id: payload.id },
            select: { enabled: true, role: true },
          });
          if (!user || !user.enabled) return done(false, 401, 'Invalid token');

          const grants = user.role === 'admin'
            ? []
            : await prisma.userServerAccess.findMany({
                where: { userId: payload.id },
                select: { serverConfigId: true },
              });

          (req as IncomingMessage & { wsIdentity?: WsIdentity }).wsIdentity = {
            id: payload.id,
            role: user.role,
            serverIds: new Set(grants.map((g: { serverConfigId: number }) => g.serverConfigId)),
          };
          done(true);
        } catch {
          done(false, 401, 'Invalid token');
        }
      })();
    },
  });

  // Carry the identity resolved in verifyClient onto the socket, so broadcasts
  // can be filtered per user (see ws/ws-broadcast.ts).
  wss.on('connection', (socket, req) => {
    const identity = (req as IncomingMessage & { wsIdentity?: WsIdentity }).wsIdentity;
    if (!identity) {
      socket.close(1008, 'Unauthenticated');
      return;
    }
    bindIdentity(socket, identity);
  });

  // Initialize TS connection pool
  const connectionPool = new ConnectionPool(prisma);
  await connectionPool.initialize();

  // Make services available via app.locals
  app.locals.prisma = prisma;
  app.locals.connectionPool = connectionPool;
  app.locals.wss = wss;

  // Load the SAML SP config/instance from the DB (no-op if SAML is unconfigured/disabled)
  await loadSamlRuntime(prisma);

  // Initialize Bot Engine
  const botEngine = new BotEngine(prisma, connectionPool, wss, app);
  app.locals.botEngine = botEngine;
  await botEngine.start();

  // Initialize Voice Bot Manager (Music Bots)
  const voiceBotManager = new VoiceBotManager(prisma, wss);
  app.locals.voiceBotManager = voiceBotManager;
  await voiceBotManager.start();

  const playlistImporter = new PlaylistImporter(prisma);
  app.locals.playlistImporter = playlistImporter;

  // Wire VoiceBotManager into BotEngine for voice action nodes in flows
  botEngine.setVoiceBotManager(voiceBotManager);

  // Wire Music Command Handler for text-based music bot control (!radio, !play, etc.)
  // Listens directly on each VoiceBot's TS3 connection (no SSH needed)
  const musicCommandHandler = new MusicCommandHandler(prisma, voiceBotManager, connectionPool);
  musicCommandHandler.setPlaylistImporter(playlistImporter);
  voiceBotManager.setMusicCommandHandler(musicCommandHandler);

  // Discord bridge: slash commands, TS notifications, stats (non-blocking)
  const discordBridge = new DiscordBridge(prisma, connectionPool, voiceBotManager);
  app.locals.discordBridge = discordBridge;
  discordBridge.start().catch((err) => {
    console.error(`[Discord] Failed to start: ${err.message}`);
  });

  // Wire Discord ↔ bot flows: Discord message triggers + send-message action
  botEngine.setDiscordBridge(discordBridge);
  discordBridge.setMessageHandler((msg) => botEngine.handleDiscordMessage(msg));

  // Connection journal: web + TS connection logging (non-blocking)
  const connectionJournal = new ConnectionJournal(prisma, connectionPool, voiceBotManager);
  app.locals.connectionJournal = connectionJournal;
  connectionJournal.start().catch((err) => {
    console.error(`[Journal] Failed to start: ${err.message}`);
  });

  server.listen(config.port, () => {
    console.log(`[TS6 WebUI] Backend running on http://localhost:${config.port}`);
    console.log(`[TS6 WebUI] WebSocket available at ws://localhost:${config.port}/ws`);
    console.log(`[TS6 WebUI] Environment: ${config.nodeEnv}`);
  });

  // Graceful shutdown
  const shutdown = async () => {
    console.log('\n[TS6 WebUI] Shutting down...');
    await discordBridge.stop();
    await connectionJournal.stop();
    await voiceBotManager.stopAll();
    botEngine.destroy();
    connectionPool.destroy();
    wss.close();
    server.close();
    await prisma.$disconnect();
    process.exit(0);
  };

  process.on('SIGTERM', shutdown);
  process.on('SIGINT', shutdown);
}

main().catch((err) => {
  console.error('Failed to start server:', err);
  process.exit(1);
});
