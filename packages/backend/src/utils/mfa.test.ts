import { describe, it, expect } from 'vitest';
import { authenticator } from 'otplib';
import {
  generateMfaSecret,
  buildOtpAuthUrl,
  verifyTotp,
  generateRecoveryCodes,
  consumeRecoveryCode,
} from './mfa.js';

describe('TOTP', () => {
  it('verifies a freshly generated token and rejects a wrong one', () => {
    const secret = generateMfaSecret();
    const token = authenticator.generate(secret);
    expect(verifyTotp(token, secret)).toBe(true);
    expect(verifyTotp('000000', secret)).toBe(false);
  });

  it('tolerates spaces in the entered token', () => {
    const secret = generateMfaSecret();
    const token = authenticator.generate(secret);
    expect(verifyTotp(`${token.slice(0, 3)} ${token.slice(3)}`, secret)).toBe(true);
  });

  it('builds an otpauth URL with issuer and account', () => {
    const url = buildOtpAuthUrl('SECRET', 'alice');
    expect(url).toContain('otpauth://totp/');
    expect(url).toContain('alice');
    expect(url).toContain('secret=SECRET');
  });
});

describe('recovery codes', () => {
  it('generates matching plain and hashed sets', () => {
    const { plain, hashed } = generateRecoveryCodes();
    expect(plain).toHaveLength(10);
    expect(hashed).toHaveLength(10);
    // 16 hex chars (64 bits) in four groups: a1b2-c3d4-e5f6-a7b8
    expect(plain[0]).toMatch(/^[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}$/);
  });

  it('consumes a valid code once and rejects reuse', () => {
    const { plain, hashed } = generateRecoveryCodes();
    const remaining = consumeRecoveryCode(plain[0], hashed);
    expect(remaining).not.toBeNull();
    expect(remaining).toHaveLength(9);
    // The same code no longer works against the reduced set
    expect(consumeRecoveryCode(plain[0], remaining!)).toBeNull();
  });

  it('is case-insensitive and trims input', () => {
    const { plain, hashed } = generateRecoveryCodes();
    expect(consumeRecoveryCode(`  ${plain[0].toUpperCase()}  `, hashed)).not.toBeNull();
  });

  it('rejects an unknown code', () => {
    const { hashed } = generateRecoveryCodes();
    expect(consumeRecoveryCode('dead-beef', hashed)).toBeNull();
  });
});
