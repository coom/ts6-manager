export type UserRole = 'admin' | 'viewer';

/**
 * Token classes. All three are signed with the same secret, so every verifier
 * must assert the class it expects — otherwise a pre-authentication token
 * (mfa/pwchange, issued after the password step alone) is accepted as a full
 * session and the second factor is bypassed.
 */
export type TokenType = 'access' | 'mfa' | 'pwchange';

export interface JwtPayload {
  id: number;
  username: string;
  role: UserRole;
  typ?: TokenType;
  iat?: number;
  exp?: number;
}
