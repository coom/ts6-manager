/**
 * config.ts fails closed when JWT_SECRET / ENCRYPTION_KEY are missing, which is
 * deliberate — a published default signing key must never reach a deployment.
 * Tests still need the module to import, so give the runner throwaway values.
 * These are only ever set inside vitest.
 */
process.env.JWT_SECRET ||= 'vitest-only-jwt-secret-0123456789abcdef';
process.env.ENCRYPTION_KEY ||= 'vitest-only-encryption-key-fedcba9876543210';
