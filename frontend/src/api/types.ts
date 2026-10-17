import type { components } from './generated/openapi';

export * from './domain-types';
export type { components, operations, paths } from './generated/openapi';
export { UserRole } from './generated/openapi-enums';

type ApiUser = components['schemas']['UserResponseDto'];

export type UserRole = ApiUser['role'];
export type User = Pick<
  ApiUser,
  'id' | 'email' | 'firstName' | 'lastName' | 'role'
> &
  Partial<Omit<ApiUser, 'id' | 'email' | 'firstName' | 'lastName' | 'role'>> & {
    organization?: string;
    metadata?: Record<string, unknown>;
  };

export interface AuthResponse {
  user: User;
  accessToken: string;
  refreshToken?: string;
  expiresIn?: number;
  requiresEmailVerification?: boolean;
}
