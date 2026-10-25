import { describe, it, expect } from 'vitest';
import { createCipheriv, randomBytes, scryptSync } from 'crypto';

// Must be set before the module under test reads config
process.env.JWT_SECRET = 'test-jwt-secret-padded-to-32-chars-min';
process.env.ENCRYPTION_KEY = 'test-encryption-key-padded-to-32-chars';
process.env.NODE_ENV = 'test';

const { encrypt, decrypt } = await import('./crypto.js');

describe('crypto', () => {
  it('round-trips a value', () => {
    const secret = 'ssh-p@ssw0rd-éàü';
    const enc = encrypt(secret);
    expect(enc).toMatch(/^enc:[0-9a-f]+:[0-9a-f]+:[0-9a-f]+$/);
    expect(decrypt(enc)).toBe(secret);
  });

  it('produces a different ciphertext per call (random IV)', () => {
    expect(encrypt('same')).not.toBe(encrypt('same'));
  });

  it('returns plaintext values as-is (pre-encryption migration)', () => {
    expect(decrypt('legacy-plaintext-password')).toBe('legacy-plaintext-password');
  });

  it('rejects malformed payloads', () => {
    expect(() => decrypt('enc:zz')).toThrow(/Invalid encrypted format/);
  });

  it('still decrypts values encrypted with the legacy JWT_SECRET-derived key', () => {
    // Reproduce what encrypt() did before ENCRYPTION_KEY existed
    const legacyKey = scryptSync('test-jwt-secret-padded-to-32-chars-min', 'ts6-webui-enc-v1', 32);
    const iv = randomBytes(12);
    const cipher = createCipheriv('aes-256-gcm', legacyKey, iv);
    let ct = cipher.update('old-stored-credential', 'utf8', 'hex');
    ct += cipher.final('hex');
    const legacy = `enc:${iv.toString('hex')}:${cipher.getAuthTag().toString('hex')}:${ct}`;

    expect(decrypt(legacy)).toBe('old-stored-credential');
  });

  it('fails on ciphertext tampered with an unknown key', () => {
    const otherKey = scryptSync('attacker-key', 'ts6-webui-enc-v1', 32);
    const iv = randomBytes(12);
    const cipher = createCipheriv('aes-256-gcm', otherKey, iv);
    let ct = cipher.update('x', 'utf8', 'hex');
    ct += cipher.final('hex');
    const foreign = `enc:${iv.toString('hex')}:${cipher.getAuthTag().toString('hex')}:${ct}`;

    expect(() => decrypt(foreign)).toThrow();
  });
});
