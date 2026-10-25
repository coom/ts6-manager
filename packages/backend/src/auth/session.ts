import jwt from 'jsonwebtoken';
import crypto from 'crypto';
import { nanoid } from 'nanoid';
import { config } from '../config.js';

const MFA_CHALLENGE_TTL = '5m';

export function signMfaChallenge(userId: number): string {
  return jwt.sign({ typ: 'mfa', mfa: true, id: userId }, config.jwtSecret, { expiresIn: MFA_CHALLENGE_TTL } as jwt.SignOptions);
}

/** Issue access + refresh tokens and the user payload (shared by local login, MFA step and SAML). */
export async function issueSession(prisma: any, user: any) {
  const payload = { typ: 'access', id: user.id, username: user.username, role: user.role };
  const accessToken = jwt.sign(payload, config.jwtSecret, { expiresIn: config.jwtAccessExpiry } as jwt.SignOptions);
  const refreshToken = crypto.randomBytes(64).toString('hex');
  const family = nanoid();
  const expiresAt = new Date();
  expiresAt.setDate(expiresAt.getDate() + 7);

  await prisma.refreshToken.create({ data: { token: refreshToken, userId: user.id, expiresAt, family } });
  await prisma.user.update({ where: { id: user.id }, data: { lastLoginAt: new Date() } });

  return {
    accessToken,
    refreshToken,
    user: { id: user.id, username: user.username, displayName: user.displayName, role: user.role, language: user.language },
  };
}

/**
 * Gating applied once the identity is proven (password or SAML assertion):
 * require the MFA second factor / enrollment, otherwise issue the session.
 */
export async function gateAfterPassword(prisma: any, user: any) {
  if (user.mfaEnabled) return { mfaRequired: true, mfaToken: signMfaChallenge(user.id) };
  if (user.mfaRequired) return { mfaSetupRequired: true, mfaToken: signMfaChallenge(user.id) };
  return issueSession(prisma, user);
}
