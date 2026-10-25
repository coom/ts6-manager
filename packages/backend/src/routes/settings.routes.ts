/**
 * Settings routes — app-wide configuration (admin only).
 * Currently handles yt-dlp cookie file management.
 */

import { Router, type Request, type Response, type NextFunction } from 'express';
import multer from 'multer';
import fs from 'fs';
import path from 'path';
import { AppError } from '../middleware/error-handler.js';
import { setYtCookieFile, getYtCookieFile } from '../voice/audio/youtube.js';
import { MAX_PLAYLIST_IMPORT_KEY, parseImportCap } from '../utils/app-settings.js';

const settingsRoutes: Router = Router();

// Cookie file stored in the backend data directory (persisted in Docker volume)
const COOKIE_DIR = path.resolve('data');
const COOKIE_PATH = path.join(COOKIE_DIR, 'yt-cookies.txt');

const upload = multer({
  limits: { fileSize: 5 * 1024 * 1024 }, // 5 MB max
  storage: multer.memoryStorage(),
});

// Admin-only guard
function requireAdmin(req: Request, _res: Response, next: NextFunction) {
  if ((req as any).user?.role !== 'admin') {
    return next(new AppError(403, 'Admin access required'));
  }
  next();
}

// GET /api/settings/yt-cookies — Check cookie file status
settingsRoutes.get('/yt-cookies', requireAdmin, (_req: Request, res: Response) => {
  const exists = fs.existsSync(COOKIE_PATH);
  const activePath = getYtCookieFile();
  res.json({
    active: !!activePath,
    exists,
    size: exists ? fs.statSync(COOKIE_PATH).size : 0,
    path: activePath,
  });
});

// POST /api/settings/yt-cookies — Upload cookie file
settingsRoutes.post('/yt-cookies', requireAdmin, upload.single('cookies'), (req: Request, res: Response, next) => {
  try {
    if (!req.file) {
      // Check if raw text was sent in body
      const text = req.body?.text;
      if (!text || typeof text !== 'string') {
        throw new AppError(400, 'No cookie file or text provided');
      }
      fs.mkdirSync(COOKIE_DIR, { recursive: true });
      fs.writeFileSync(COOKIE_PATH, text, 'utf-8');
    } else {
      fs.mkdirSync(COOKIE_DIR, { recursive: true });
      fs.writeFileSync(COOKIE_PATH, req.file.buffer);
    }

    setYtCookieFile(COOKIE_PATH);
    const size = fs.statSync(COOKIE_PATH).size;
    console.log(`[yt-dlp] Cookie file uploaded (${size} bytes)`);
    res.json({ success: true, size });
  } catch (err) { next(err); }
});

// DELETE /api/settings/yt-cookies — Remove cookie file
settingsRoutes.delete('/yt-cookies', requireAdmin, (_req: Request, res: Response, next) => {
  try {
    if (fs.existsSync(COOKIE_PATH)) {
      fs.unlinkSync(COOKIE_PATH);
    }
    setYtCookieFile(null);
    console.log('[yt-dlp] Cookie file removed');
    res.json({ success: true });
  } catch (err) { next(err); }
});

// ─── Reverse proxy / client IP ───────────────────────────────

const TRUST_PROXY_KEY = 'proxy.trustHops';
export const DEFAULT_TRUST_PROXY = 1;

/** Apply a hop count to Express' 'trust proxy' setting (recompiled live). */
export function applyTrustProxy(app: any, hops: number): void {
  app.set('trust proxy', hops);
}

/** Load the configured hop count from AppSetting (default 1 = frontend nginx). */
export async function loadTrustProxy(prisma: any): Promise<number> {
  try {
    const row = await prisma.appSetting.findUnique({ where: { key: TRUST_PROXY_KEY } });
    const n = row ? parseInt(row.value) : DEFAULT_TRUST_PROXY;
    return Number.isInteger(n) && n >= 0 ? n : DEFAULT_TRUST_PROXY;
  } catch {
    return DEFAULT_TRUST_PROXY;
  }
}

// GET /api/settings/proxy — hop count + the IP detected for THIS request,
// so the admin can tune the count until it shows their real public IP.
settingsRoutes.get('/proxy', requireAdmin, async (req: Request, res: Response, next) => {
  try {
    const trustHops = await loadTrustProxy(req.app.locals.prisma);
    res.json({ trustHops, detectedIp: req.ip });
  } catch (err) { next(err); }
});

// PUT /api/settings/proxy — persist and apply the hop count live (no restart)
settingsRoutes.put('/proxy', requireAdmin, async (req: Request, res: Response, next) => {
  try {
    const hops = parseInt(req.body.trustHops);
    if (isNaN(hops) || hops < 0 || hops > 16) throw new AppError(400, 'trustHops must be between 0 and 16');
    await req.app.locals.prisma.appSetting.upsert({
      where: { key: TRUST_PROXY_KEY },
      update: { value: String(hops) },
      create: { key: TRUST_PROXY_KEY, value: String(hops) },
    });
    applyTrustProxy(req.app, hops);
    res.json({ trustHops: hops });
  } catch (err) { next(err); }
});

// GET /limits — tunable ceilings
settingsRoutes.get('/limits', requireAdmin, async (req: Request, res: Response, next) => {
  try {
    const row = await req.app.locals.prisma.appSetting.findUnique({
      where: { key: MAX_PLAYLIST_IMPORT_KEY },
    });
    res.json({ maxPlaylistImport: parseImportCap(row?.value) });
  } catch (err) { next(err); }
});

// PUT /limits
settingsRoutes.put('/limits', requireAdmin, async (req: Request, res: Response, next) => {
  try {
    const value = Number(req.body?.maxPlaylistImport);
    if (!Number.isFinite(value) || value < 0 || value > 1000) {
      throw new AppError(400, 'maxPlaylistImport must be between 0 and 1000');
    }
    const stored = String(Math.floor(value));
    await req.app.locals.prisma.appSetting.upsert({
      where: { key: MAX_PLAYLIST_IMPORT_KEY },
      update: { value: stored },
      create: { key: MAX_PLAYLIST_IMPORT_KEY, value: stored },
    });
    res.json({ maxPlaylistImport: Math.floor(value) });
  } catch (err) { next(err); }
});

export { settingsRoutes };
