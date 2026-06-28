/**
 * Issue #542: Refresh token signed with default JwtModule secret
 *
 * Root cause:
 * - AuthModule registers JwtModule with JWT_ACCESS_SECRET
 * - JwtManagementService.generateRefreshToken() calls signAsync() with
 *   secret: configService.get<string>('JWT_REFRESH_SECRET')
 * - .env.example only defines JWT_SECRET, not JWT_REFRESH_SECRET
 * - When config returns undefined, signAsync falls back to JwtModule's
 *   default secret (JWT_ACCESS_SECRET), meaning both token types share
 *   the same signing key — undermining token separation.
 *
 * Fix: Fall back to JWT_ACCESS_SECRET when JWT_REFRESH_SECRET is unset.
 */

// ---- FLAWED (jwt.service.ts) ----
async generateRefreshToken(payload: JwtPayload): Promise<string> {
  const expiresIn = (this.configService.get<string>('JWT_REFRESH_EXPIRES_IN') || '7d') as any;
  const secret = this.configService.get<string>('JWT_REFRESH_SECRET');
  return this.nestJwtService.signAsync(payload as any, { expiresIn, secret });
}

// ---- FIXED ----
async generateRefreshToken(payload: JwtPayload): Promise<string> {
  const expiresIn = (this.configService.get<string>('JWT_REFRESH_EXPIRES_IN') || '7d') as any;
  const secret = this.configService.get<string>('JWT_REFRESH_SECRET')
    ?? this.configService.get<string>('JWT_ACCESS_SECRET');
  if (!secret) {
    throw new Error('Neither JWT_REFRESH_SECRET nor JWT_ACCESS_SECRET is configured');
  }
  return this.nestJwtService.signAsync(payload as any, { expiresIn, secret });
}
