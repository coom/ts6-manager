import { Router, Request, Response } from 'express';
import bcrypt from 'bcryptjs';
import jwt from 'jsonwebtoken';
import crypto from 'crypto';
import { config } from '../config.js';
import { authMiddleware } from '../middleware/auth.js';
import { AppError } from '../middleware/error-handler.js';
import { validatePassword, loadPasswordPolicy } from '../utils/validate-password.js';
import { encrypt, decrypt } from '../utils/crypto.js';
import { generateMfaSecret, buildOtpAuthUrl, verifyTotp, generateRecoveryCodes, consumeRecoveryCode } from '../utils/mfa.js';
import { isIpWebBanned } from '../utils/web-ban.js';
import QRCode from 'qrcode';
import { createTrustedDevice, clearTrustedCookie, resolveTrustedCookie } from '../utils/trusted-device-service.js';
import { TRUSTED_COOKIE_NAME } from '../utils/trusted-device.js';
import { issueSession, gateAfterPassword } from '../auth/session.js';

export const authRoutes: Router = Router();

/** A user can attempt local password login only if enabled and has a local password. */
export function canLocalLogin(user: { enabled: boolean; passwordHash: string | null } | null): boolean {
  return !!user && user.enabled && !!user.passwordHash;
}

// Endpoints that re-verify the current password (change-password, MFA disable, PUT
// /password) must reject SSO accounts before reaching bcrypt.compare: passwordHash
// is null for SAML-provisioned users, and bcrypt.compare(x, null) throws.
export function requirePasswordHash(passwordHash: string | null): string {
  if (!passwordHash) throw new AppError(400, 'Not available for SSO accounts');
  return passwordHash;
}

// Short-lived token proving the password step passed, scoped to the MFA step.
function verifyMfaChallenge(token: string): number {
  const payload = jwt.verify(token, config.jwtSecret, { algorithms: ['HS256'] }) as any;
  if (payload?.typ !== 'mfa' || !payload.mfa || !payload.id) throw new AppError(401, 'Invalid MFA session');
  return payload.id;
}

// Short-lived token proving auth fully passed, scoped to the forced password change.
function signChangeToken(userId: number): string {
  return jwt.sign({ typ: 'pwchange', pwchange: true, id: userId }, config.jwtSecret, { expiresIn: '10m' } as jwt.SignOptions);
}
function verifyChangeToken(token: string): number {
  const payload = jwt.verify(token, config.jwtSecret, { algorithms: ['HS256'] }) as any;
  if (payload?.typ !== 'pwchange' || !payload.pwchange || !payload.id) throw new AppError(401, 'Invalid session');
  return payload.id;
}

// The caller's own trusted-device selector (first segment of the cookie), or null.
function currentSelector(req: Request): string | null {
  return (req.cookies?.[TRUSTED_COOKIE_NAME] || '').split('.')[0] || null;
}

// If the client asked to trust this device, mint a trusted-device cookie.
// Safe no-op when trustDevice is falsy.
async function maybeTrustDevice(prisma: any, req: Request, res: Response, userId: number, trustDevice: unknown) {
  if (trustDevice === true) {
    await createTrustedDevice(prisma, res, userId, req.headers['user-agent'], req.ip);
  }
}

// An account is eligible for cookie auto-login only if it's fully provisioned:
// enabled, not IP-banned, no forced password change, and MFA already set up if required.
async function trustedLoginAllowed(prisma: any, user: any, ip: string): Promise<boolean> {
  if (!user || !user.enabled) return false;
  if (await isIpWebBanned(prisma, ip)) return false;
  if (user.mustChangePassword) return false;
  if (user.mfaRequired && !user.mfaEnabled) return false;
  return true;
}

authRoutes.post('/login', async (req: Request, res: Response, next) => {
  const journal = req.app.locals.connectionJournal;
  try {
    const { username, password } = req.body;
    if (!username || !password) throw new AppError(400, 'Username and password required');

    const prisma = req.app.locals.prisma;

    // Web IP ban: reject before authenticating
    if (await isIpWebBanned(prisma, req.ip || '')) {
      throw new AppError(403, 'Access denied');
    }
    const user = await prisma.user.findUnique({ where: { username } });

    if (!canLocalLogin(user)) {
      journal?.recordWebLogin(String(username), req.ip || '', false);
      throw new AppError(401, 'Invalid credentials');
    }

    const valid = await bcrypt.compare(password, user.passwordHash as string);
    if (!valid) {
      journal?.recordWebLogin(user.username, req.ip || '', false);
      throw new AppError(401, 'Invalid credentials');
    }

    journal?.recordWebLogin(user.username, req.ip || '', true);

    // Forced password change comes first — before MFA enrollment.
    if (user.mustChangePassword) {
      res.json({ mustChangePassword: true, changeToken: signChangeToken(user.id) });
      return;
    }

    const result = await gateAfterPassword(prisma, user);
    if ((result as any).accessToken) await maybeTrustDevice(prisma, req, res, user.id, req.body.trustDevice);
    res.json(result);
  } catch (err) { next(err); }
});

// Second login step: verify a TOTP or recovery code against the MFA challenge.
authRoutes.post('/login/mfa', async (req: Request, res: Response, next) => {
  try {
    const { mfaToken, code } = req.body;
    if (!mfaToken || !code) throw new AppError(400, 'MFA token and code required');

    const userId = verifyMfaChallenge(mfaToken);
    const prisma = req.app.locals.prisma;
    const user = await prisma.user.findUnique({ where: { id: userId } });
    if (!user || !user.enabled || !user.mfaEnabled || !user.mfaSecret) {
      throw new AppError(401, 'Invalid MFA session');
    }

    const okTotp = verifyTotp(String(code), decrypt(user.mfaSecret));
    if (!okTotp) {
      // Fall back to a one-time recovery code
      const stored: string[] = user.mfaRecoveryCodes ? JSON.parse(decrypt(user.mfaRecoveryCodes)) : [];
      const remaining = consumeRecoveryCode(String(code), stored);
      if (!remaining) throw new AppError(401, 'Invalid code');
      await prisma.user.update({
        where: { id: user.id },
        data: { mfaRecoveryCodes: encrypt(JSON.stringify(remaining)) },
      });
    }

    // The MFA step always issues a full session, so (unlike /login) no accessToken guard is needed.
    await maybeTrustDevice(prisma, req, res, user.id, req.body.trustDevice);
    res.json(await issueSession(prisma, user));
  } catch (err) {
    if (err instanceof jwt.JsonWebTokenError || err instanceof jwt.TokenExpiredError) {
      return next(new AppError(401, 'MFA session expired, please log in again'));
    }
    next(err);
  }
});

// Forced password change at login: verify current password, set the new one
// (policy-checked), clear the flag, then continue to MFA / issue the session.
authRoutes.post('/login/change-password', async (req: Request, res: Response, next) => {
  try {
    const { changeToken, currentPassword, newPassword } = req.body;
    if (!changeToken || !currentPassword || !newPassword) throw new AppError(400, 'All fields required');

    const userId = verifyChangeToken(changeToken);
    const prisma = req.app.locals.prisma;
    const user = await prisma.user.findUnique({ where: { id: userId } });
    if (!user || !user.enabled) throw new AppError(401, 'Invalid session');

    const valid = await bcrypt.compare(currentPassword, requirePasswordHash(user.passwordHash));
    if (!valid) throw new AppError(401, 'Current password is incorrect');

    const pwError = validatePassword(newPassword, await loadPasswordPolicy(prisma));
    if (pwError) throw new AppError(400, pwError);

    const passwordHash = await bcrypt.hash(newPassword, 12);
    const updated = await prisma.user.update({
      where: { id: user.id },
      data: { passwordHash, mustChangePassword: false },
    });
    // Invalidate any existing refresh tokens and trusted devices, then continue to MFA / session
    await prisma.refreshToken.deleteMany({ where: { userId: user.id } });
    await prisma.trustedDevice.deleteMany({ where: { userId: user.id } });
    clearTrustedCookie(res);
    const result = await gateAfterPassword(prisma, updated);
    if ((result as any).accessToken) await maybeTrustDevice(prisma, req, res, user.id, req.body.trustDevice);
    res.json(result);
  } catch (err) {
    if (err instanceof jwt.JsonWebTokenError || err instanceof jwt.TokenExpiredError) {
      return next(new AppError(401, 'Session expired, please log in again'));
    }
    next(err);
  }
});

// Recognize a trusted device WITHOUT issuing a session. Returns the display
// identity so the login screen can offer "Continue as X".
authRoutes.get('/trusted/peek', async (req: Request, res: Response, next) => {
  try {
    const prisma = req.app.locals.prisma;
    const user = await resolveTrustedCookie(prisma, req.cookies?.[TRUSTED_COOKIE_NAME]);
    if (!user || !(await trustedLoginAllowed(prisma, user, req.ip || ''))) {
      clearTrustedCookie(res);
      res.json({ trusted: false });
      return;
    }
    res.json({ trusted: true, username: user.username, displayName: user.displayName });
  } catch (err) { next(err); }
});

// Exchange a valid trusted-device cookie for a full session (bypasses password + MFA).
authRoutes.post('/trusted/session', async (req: Request, res: Response, next) => {
  const journal = req.app.locals.connectionJournal;
  try {
    const prisma = req.app.locals.prisma;
    const user = await resolveTrustedCookie(prisma, req.cookies?.[TRUSTED_COOKIE_NAME]);
    if (!user || !(await trustedLoginAllowed(prisma, user, req.ip || ''))) {
      clearTrustedCookie(res);
      throw new AppError(401, 'Trusted device not recognized');
    }
    journal?.recordWebLogin(user.username, req.ip || '', true);
    res.json(await issueSession(prisma, user));
  } catch (err) { next(err); }
});

authRoutes.post('/refresh', async (req: Request, res: Response, next) => {
  try {
    const { refreshToken } = req.body;
    if (!refreshToken) throw new AppError(400, 'Refresh token required');

    const prisma = req.app.locals.prisma;
    const stored = await prisma.refreshToken.findUnique({
      where: { token: refreshToken },
      include: { user: true },
    });

    if (!stored) {
      // H5: Token not found — check if it was already used (reuse detection)
      const replaced = await prisma.refreshToken.findFirst({
        where: { replacedBy: refreshToken },
      });
      if (replaced) {
        // Reuse detected! Revoke entire token family
        console.warn(`[SECURITY] Refresh token reuse detected for user ${replaced.userId}. Revoking all tokens.`);
        await prisma.refreshToken.deleteMany({ where: { userId: replaced.userId } });
      }
      throw new AppError(401, 'Invalid refresh token');
    }

    if (stored.expiresAt < new Date() || !stored.user.enabled) {
      await prisma.refreshToken.delete({ where: { id: stored.id } });
      throw new AppError(401, 'Invalid refresh token');
    }

    // Rotate: mark old token as replaced, create new one in same family
    const newRefreshToken = crypto.randomBytes(64).toString('hex');
    const expiresAt = new Date();
    expiresAt.setDate(expiresAt.getDate() + 7);

    // Atomically claim this token for rotation. updateMany never throws on a
    // missing/already-claimed row, so two concurrent /refresh calls with the
    // same token can't both crash with P2025: the loser claims 0 rows and gets
    // a clean 401 instead of a 500 (refresh tokens are one-time use by design).
    const claimed = await prisma.refreshToken.updateMany({
      where: { id: stored.id, replacedBy: null },
      data: { replacedBy: newRefreshToken },
    });
    if (claimed.count === 0) {
      throw new AppError(401, 'Invalid refresh token');
    }

    await prisma.refreshToken.create({
      data: { token: newRefreshToken, userId: stored.userId, expiresAt, family: stored.family },
    });

    // Delete old token after creating new one (deleteMany: no throw if gone)
    await prisma.refreshToken.deleteMany({ where: { id: stored.id } });

    const payload = { typ: 'access', id: stored.user.id, username: stored.user.username, role: stored.user.role };
    const accessToken = jwt.sign(payload, config.jwtSecret, { expiresIn: config.jwtAccessExpiry } as jwt.SignOptions);

    res.json({ accessToken, refreshToken: newRefreshToken });
  } catch (err) { next(err); }
});

authRoutes.post('/logout', async (req: Request, res: Response, next) => {
  try {
    const { refreshToken } = req.body;
    if (refreshToken) {
      const prisma = req.app.locals.prisma;
      await prisma.refreshToken.deleteMany({ where: { token: refreshToken } });
    }
    res.status(204).send();
  } catch (err) { next(err); }
});

authRoutes.get('/me', authMiddleware, async (req: Request, res: Response, next) => {
  try {
    const prisma = req.app.locals.prisma;
    const user = await prisma.user.findUnique({ where: { id: req.user!.id } });
    if (!user) throw new AppError(404, 'User not found');

    res.json({
      user: {
        id: user.id,
        username: user.username,
        displayName: user.displayName,
        role: user.role,
        mfaEnabled: user.mfaEnabled,
        mfaRequired: user.mfaRequired,
        language: user.language,
      },
    });
  } catch (err) { next(err); }
});

// List the current user's trusted devices. `current` flags the calling device.
authRoutes.get('/trusted', authMiddleware, async (req: Request, res: Response, next) => {
  try {
    const prisma = req.app.locals.prisma;
    const split = currentSelector(req);
    const devices = await prisma.trustedDevice.findMany({
      where: { userId: req.user!.id },
      orderBy: { createdAt: 'desc' },
    });
    res.json({
      devices: devices.map((d: any) => ({
        id: d.id,
        createdAt: d.createdAt,
        lastUsedAt: d.lastUsedAt,
        expiresAt: d.expiresAt,
        userAgent: d.userAgent,
        ipAddress: d.ipAddress,
        current: split !== null && d.selector === split,
      })),
    });
  } catch (err) { next(err); }
});

// Revoke ALL trusted devices for the current user.
authRoutes.delete('/trusted', authMiddleware, async (req: Request, res: Response, next) => {
  try {
    await req.app.locals.prisma.trustedDevice.deleteMany({ where: { userId: req.user!.id } });
    clearTrustedCookie(res);
    res.status(204).send();
  } catch (err) { next(err); }
});

// Revoke a single trusted device by id (must belong to the current user).
authRoutes.delete('/trusted/:id', authMiddleware, async (req: Request, res: Response, next) => {
  try {
    const id = Number(req.params.id);
    if (!Number.isInteger(id) || id <= 0) throw new AppError(400, 'Invalid id');
    const prisma = req.app.locals.prisma;
    const device = await prisma.trustedDevice.findUnique({ where: { id } });
    if (!device || device.userId !== req.user!.id) throw new AppError(404, 'Not found');
    const isCurrent = currentSelector(req) === device.selector;
    await prisma.trustedDevice.delete({ where: { id } });
    if (isCurrent) clearTrustedCookie(res);
    res.status(204).send();
  } catch (err) { next(err); }
});

const SUPPORTED_LANGUAGES = ['en', 'fr', 'de', 'es', 'it'];

// PUT /api/auth/language — persist the current user's UI language
authRoutes.put('/language', authMiddleware, async (req: Request, res: Response, next) => {
  try {
    const { language } = req.body;
    if (!SUPPORTED_LANGUAGES.includes(language)) throw new AppError(400, 'Unsupported language');
    await req.app.locals.prisma.user.update({ where: { id: req.user!.id }, data: { language } });
    res.json({ language });
  } catch (err) { next(err); }
});

// ─── MFA enrollment (self-service) ───────────────────────────

// Start enrollment: generate a pending secret + QR. Allowed either with a
// normal session or with an MFA challenge token (admin-forced first setup).
/**
 * User id from a Bearer access token, or null.
 *
 * These routes are on the public /api/auth mount, so authMiddleware has not run
 * and req.user is always unset — which made self-service enrolment from the
 * Account tab fail with 401 no matter what. Resolving the token here restores
 * it without forcing authMiddleware onto the routes, which would break the
 * admin-forced first setup (an mfaToken, with no session to present yet).
 *
 * Only `typ === 'access'` is accepted, so an MFA challenge token cannot be
 * replayed here to enrol a *new* authenticator with the password alone.
 */
function accessTokenUserId(req: Request): number | null {
  const header = req.headers.authorization;
  if (!header?.startsWith('Bearer ')) return null;
  try {
    const payload = jwt.verify(header.substring(7), config.jwtSecret, { algorithms: ['HS256'] }) as any;
    return payload?.typ === 'access' && payload.id ? payload.id : null;
  } catch {
    return null;
  }
}

async function resolveEnrollUser(req: Request): Promise<{ prisma: any; user: any }> {
  const prisma = req.app.locals.prisma;
  let userId = req.user?.id ?? accessTokenUserId(req);
  if (!userId && req.body?.mfaToken) userId = verifyMfaChallenge(req.body.mfaToken);
  if (!userId) throw new AppError(401, 'Authentication required');
  const user = await prisma.user.findUnique({ where: { id: userId } });
  if (!user || !user.enabled) throw new AppError(401, 'Invalid session');
  return { prisma, user };
}

authRoutes.post('/mfa/setup', async (req: Request, res: Response, next) => {
  try {
    const { prisma, user } = await resolveEnrollUser(req);
    if (user.mfaEnabled) throw new AppError(400, 'MFA is already enabled');

    const secret = generateMfaSecret();
    await prisma.user.update({ where: { id: user.id }, data: { mfaPendingSecret: encrypt(secret) } });

    const otpauth = buildOtpAuthUrl(secret, user.username);
    const qrDataUrl = await QRCode.toDataURL(otpauth);
    res.json({ secret, otpauth, qrDataUrl });
  } catch (err) {
    if (err instanceof jwt.JsonWebTokenError) return next(new AppError(401, 'MFA session expired'));
    next(err);
  }
});

authRoutes.post('/mfa/enable', async (req: Request, res: Response, next) => {
  try {
    const { code } = req.body;
    if (!code) throw new AppError(400, 'Verification code required');
    const { prisma, user } = await resolveEnrollUser(req);
    if (user.mfaEnabled) throw new AppError(400, 'MFA is already enabled');
    if (!user.mfaPendingSecret) throw new AppError(400, 'Start MFA setup first');

    const secret = decrypt(user.mfaPendingSecret);
    if (!verifyTotp(String(code), secret)) throw new AppError(401, 'Invalid code');

    const { plain, hashed } = generateRecoveryCodes();
    await prisma.user.update({
      where: { id: user.id },
      data: {
        mfaEnabled: true,
        mfaSecret: encrypt(secret),
        mfaPendingSecret: null,
        mfaRecoveryCodes: encrypt(JSON.stringify(hashed)),
      },
    });
    res.json({ success: true, recoveryCodes: plain });
  } catch (err) {
    if (err instanceof jwt.JsonWebTokenError) return next(new AppError(401, 'MFA session expired'));
    next(err);
  }
});

authRoutes.post('/mfa/disable', authMiddleware, async (req: Request, res: Response, next) => {
  try {
    const { password } = req.body;
    if (!password) throw new AppError(400, 'Password required');
    const prisma = req.app.locals.prisma;
    const user = await prisma.user.findUnique({ where: { id: req.user!.id } });
    if (!user) throw new AppError(404, 'User not found');

    const valid = await bcrypt.compare(password, requirePasswordHash(user.passwordHash));
    if (!valid) throw new AppError(401, 'Password is incorrect');
    if (user.mfaRequired) throw new AppError(403, 'MFA is required by an administrator and cannot be disabled');

    await prisma.user.update({
      where: { id: user.id },
      data: { mfaEnabled: false, mfaSecret: null, mfaPendingSecret: null, mfaRecoveryCodes: null },
    });
    res.status(204).send();
  } catch (err) { next(err); }
});

authRoutes.put('/password', authMiddleware, async (req: Request, res: Response, next) => {
  try {
    const { currentPassword, newPassword } = req.body;
    if (!currentPassword || !newPassword) throw new AppError(400, 'Both passwords required');

    const prisma = req.app.locals.prisma;
    const pwError = validatePassword(newPassword, await loadPasswordPolicy(prisma));
    if (pwError) throw new AppError(400, pwError);
    const user = await prisma.user.findUnique({ where: { id: req.user!.id } });
    if (!user) throw new AppError(404, 'User not found');

    const valid = await bcrypt.compare(currentPassword, requirePasswordHash(user.passwordHash));
    if (!valid) throw new AppError(401, 'Current password is incorrect');

    const passwordHash = await bcrypt.hash(newPassword, 12);
    await prisma.user.update({ where: { id: user.id }, data: { passwordHash } });

    // Revoke all refresh tokens AND trusted devices on password change
    await prisma.refreshToken.deleteMany({ where: { userId: user.id } });
    await prisma.trustedDevice.deleteMany({ where: { userId: user.id } });
    clearTrustedCookie(res);

    res.status(204).send();
  } catch (err) { next(err); }
});
