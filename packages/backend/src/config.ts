import dotenv from 'dotenv';
import path from 'path';
import { fileURLToPath } from 'url';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
dotenv.config({ path: path.resolve(__dirname, '../../../.env') });

/**
 * Required secret. Fails closed rather than falling back to a published
 * default: JWT_SECRET signs every session, and ENCRYPTION_KEY protects the
 * stored ServerQuery keys, SSH passwords and TOTP secrets. A default that only
 * aborts when NODE_ENV is exactly "production" still ships a known signing key
 * to any deployment that runs the backend directly, under pm2 or under systemd.
 */
function requireSecret(name: 'JWT_SECRET' | 'ENCRYPTION_KEY'): string {
  const value = process.env[name];
  if (!value || value.trim().length === 0) {
    console.error(`[FATAL] ${name} is not set. Generate one with: openssl rand -hex 32`);
    process.exit(1);
  }
  if (value.length < 32) {
    console.error(`[FATAL] ${name} is too short (${value.length} chars). Use at least 32; generate one with: openssl rand -hex 32`);
    process.exit(1);
  }
  return value;
}

export const config = {
  port: parseInt(process.env.PORT || '3001', 10),
  nodeEnv: process.env.NODE_ENV || 'development',
  databaseUrl: process.env.DATABASE_URL || 'file:./data/ts6webui.db',
  jwtSecret: requireSecret('JWT_SECRET'),
  encryptionKey: requireSecret('ENCRYPTION_KEY'),
  jwtAccessExpiry: process.env.JWT_ACCESS_EXPIRY || '15m',
  jwtRefreshExpiry: process.env.JWT_REFRESH_EXPIRY || '7d',
  frontendUrl: process.env.FRONTEND_URL || 'http://localhost:5173',
  tsAllowSelfSigned: process.env.TS_ALLOW_SELF_SIGNED === 'true' || process.env.TS_ALLOW_SELF_SIGNED === '1',
};
