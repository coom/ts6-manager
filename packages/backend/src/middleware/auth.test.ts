import { describe, it, expect, vi } from 'vitest';
import jwt from 'jsonwebtoken';
import type { Request, Response } from 'express';
import { authMiddleware } from './auth.js';
import { config } from '../config.js';

/**
 * Regression cover for the token-class confusion: access, MFA-challenge and
 * password-change tokens are all HS256 over the same secret, so verifying the
 * signature alone let a caller who knew only a password present the challenge
 * token as a session and skip the second factor entirely.
 */

const ADMIN = { enabled: true, role: 'admin' };

function run(token: string, dbUser: unknown = ADMIN) {
  const status = vi.fn().mockReturnThis();
  const json = vi.fn();
  const next = vi.fn();
  const findUnique = vi.fn().mockResolvedValue(dbUser);

  const req = {
    headers: { authorization: `Bearer ${token}` },
    app: { locals: { prisma: { user: { findUnique } } } },
  } as unknown as Request;
  const res = { status, json } as unknown as Response;

  authMiddleware(req, res, next);
  // Let the findUnique promise chain settle before asserting.
  return new Promise<{ status: typeof status; json: typeof json; next: typeof next; req: Request }>(
    (resolve) => setImmediate(() => resolve({ status, json, next, req })),
  );
}

const sign = (payload: object) => jwt.sign(payload, config.jwtSecret, { expiresIn: '5m' });

describe('authMiddleware token class', () => {
  it('accepts a real access token', async () => {
    const { next, status, req } = await run(sign({ typ: 'access', id: 42, username: 'root', role: 'admin' }));
    expect(next).toHaveBeenCalledOnce();
    expect(status).not.toHaveBeenCalled();
    expect(req.user?.id).toBe(42);
  });

  it('rejects an MFA challenge token presented as a session', async () => {
    const { next, status } = await run(sign({ typ: 'mfa', mfa: true, id: 42 }));
    expect(next).not.toHaveBeenCalled();
    expect(status).toHaveBeenCalledWith(401);
  });

  it('rejects a forced-password-change token presented as a session', async () => {
    const { next, status } = await run(sign({ typ: 'pwchange', pwchange: true, id: 42 }));
    expect(next).not.toHaveBeenCalled();
    expect(status).toHaveBeenCalledWith(401);
  });

  it('rejects a token with no class claim at all', async () => {
    const { next, status } = await run(sign({ id: 42, username: 'root', role: 'admin' }));
    expect(next).not.toHaveBeenCalled();
    expect(status).toHaveBeenCalledWith(401);
  });

  it('takes the role from the database, not the token', async () => {
    const { req } = await run(
      sign({ typ: 'access', id: 7, username: 'viewer', role: 'admin' }),
      { enabled: true, role: 'viewer' },
    );
    expect(req.user?.role).toBe('viewer');
  });

  it('rejects a disabled account', async () => {
    const { next, status } = await run(
      sign({ typ: 'access', id: 7, username: 'gone', role: 'admin' }),
      { enabled: false, role: 'admin' },
    );
    expect(next).not.toHaveBeenCalled();
    expect(status).toHaveBeenCalledWith(401);
  });
});
