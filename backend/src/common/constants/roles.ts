/**
 * Application role constants
 */
export enum UserRole {
  ADMIN = 'admin',
  ISSUER = 'issuer',
  USER = 'user',
  AUDITOR = 'auditor',
  RECIPIENT = 'recipient',
  VERIFIER = 'verifier',
}

export const ROLE_HIERARCHY = {
  [UserRole.ADMIN]: [
    UserRole.ADMIN,
    UserRole.ISSUER,
    UserRole.USER,
    UserRole.AUDITOR,
    UserRole.RECIPIENT,
    UserRole.VERIFIER,
  ],
  [UserRole.ISSUER]: [UserRole.ISSUER, UserRole.USER, UserRole.RECIPIENT],
  [UserRole.AUDITOR]: [UserRole.AUDITOR, UserRole.USER, UserRole.VERIFIER],
  [UserRole.VERIFIER]: [UserRole.VERIFIER, UserRole.USER],
  [UserRole.RECIPIENT]: [UserRole.RECIPIENT, UserRole.USER],
  [UserRole.USER]: [UserRole.USER],
};

export const PUBLIC_ROUTES = [
  'auth/login',
  'auth/register',
  'auth/refresh',
  'health',
  'health/status',
];
