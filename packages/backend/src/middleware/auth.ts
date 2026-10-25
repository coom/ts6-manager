import { Request, Response, NextFunction } from 'express';
import jwt from 'jsonwebtoken';
import { config } from '../config.js';
import type { JwtPayload } from '@ts6/common';

declare global {
  namespace Express {
    interface Request {
      user?: JwtPayload;
    }
  }
}

export function authMiddleware(req: Request, res: Response, next: NextFunction) {
  const authHeader = req.headers.authorization;
  if (!authHeader?.startsWith('Bearer ')) {
    res.status(401).json({ error: 'No token provided' });
    return;
  }

  const token = authHeader.substring(7);
  try {
    const payload = jwt.verify(token, config.jwtSecret, { algorithms: ['HS256'] }) as JwtPayload;

    // MFA challenge and forced-password-change tokens are signed with the same
    // secret but are issued after the password step *alone*. Without this check
    // either one is accepted here as a full session, bypassing the second factor.
    if (payload.typ !== 'access') {
      res.status(401).json({ error: 'Invalid or expired token' });
      return;
    }

    // H4+M5: Lightweight DB check — verify user still exists, is enabled, and get fresh role
    const prisma = req.app.locals.prisma;
    prisma.user.findUnique({
      where: { id: payload.id },
      select: { enabled: true, role: true },
    }).then((user: { enabled: boolean; role: string } | null) => {
      if (!user || !user.enabled) {
        res.status(401).json({ error: 'User account disabled or deleted' });
        return;
      }
      // Build the identity explicitly rather than spreading the payload, so a
      // claim the signer did not intend can never end up on req.user.
      req.user = {
        typ: 'access',
        id: payload.id,
        username: payload.username,
        role: user.role as JwtPayload['role'], // fresh from the DB, not the stale JWT
      };
      next();
    }).catch(() => {
      res.status(500).json({ error: 'Internal server error' });
    });
  } catch {
    res.status(401).json({ error: 'Invalid or expired token' });
  }
}
