import {
  Injectable,
  CanActivate,
  ExecutionContext,
  Optional,
} from '@nestjs/common';
import { JwtService } from '@nestjs/jwt';
import { ConfigService } from '@nestjs/config';
import { PUBLIC_KEY } from '../decorators/public.decorator';
import { ModuleRef, Reflector } from '@nestjs/core';
import { DataSource } from 'typeorm';
import { AuthException } from '../exceptions';
import { ErrorCode } from '../constants/error-codes';
import { Request } from 'express';
import { JwtManagementService } from '../../modules/auth/services/jwt.service';
import { User, UserStatus } from '../../modules/users/entities/user.entity';

/**
 * Canonical shape attached to `req.user` by JwtAuthGuard.
 * `id` and `sub` are aliases for the same user id so both
 * `@CurrentUser('id')` and `@CurrentUser('sub')` resolve correctly,
 * regardless of which guard authenticated the request.
 */
export interface AuthenticatedUser {
  id: string;
  sub: string;
  email: string;
  role: string;
}

interface RequestWithUser extends Request {
  user: AuthenticatedUser;
}

/** How long a user's active/inactive lookup is reused, in ms. */
const USER_STATUS_CACHE_MS = 30_000;
const USER_STATUS_CACHE_MAX = 10_000;

/**
 * JWT Authentication Guard
 * Validates JWT tokens from the Authorization header, rejects tokens that were
 * blacklisted on logout, and rejects users that are missing, deactivated or
 * suspended (#1118).
 */
@Injectable()
export class JwtAuthGuard implements CanActivate {
  private readonly userStatusCache = new Map<
    string,
    { active: boolean; expiresAt: number }
  >();

  constructor(
    private jwtService: JwtService,
    private reflector: Reflector,
    private configService: ConfigService,
    @Optional() private moduleRef?: ModuleRef,
    @Optional() private dataSource?: DataSource,
  ) {}

  async canActivate(context: ExecutionContext): Promise<boolean> {
    // Check if the route is public
    const isPublic = this.reflector.getAllAndOverride<boolean>(PUBLIC_KEY, [
      context.getHandler(),
      context.getClass(),
    ]);

    if (isPublic) {
      return true;
    }

    const request = context.switchToHttp().getRequest<RequestWithUser>();
    const token = this.extractTokenFromHeader(request);

    if (!token) {
      throw new AuthException(
        ErrorCode.UNAUTHORIZED,
        'Missing authentication token',
      );
    }

    let payload: { sub: string; email: string; role: string };
    try {
      const secret = this.configService.get<string>('JWT_ACCESS_SECRET');

      if (!secret) {
        throw new AuthException(
          ErrorCode.UNAUTHORIZED,
          'JWT configuration is missing',
        );
      }

      payload = this.jwtService.verify(token, {
        secret,
      });
    } catch (error: unknown) {
      if (error instanceof Error && error.name === 'TokenExpiredError') {
        throw new AuthException(ErrorCode.TOKEN_EXPIRED, 'Token has expired');
      }
      throw new AuthException(ErrorCode.TOKEN_INVALID, 'Invalid token');
    }

    if (await this.isBlacklisted(token)) {
      throw new AuthException(
        ErrorCode.TOKEN_INVALID,
        'Token has been revoked',
      );
    }

    if (!(await this.isUserActive(payload.sub))) {
      throw new AuthException(ErrorCode.UNAUTHORIZED, 'User is not active');
    }

    // Single canonical req.user shape: id and sub are aliases of the same
    // user id, so @CurrentUser('id') and @CurrentUser('sub') both resolve.
    request.user = {
      id: payload.sub,
      sub: payload.sub,
      email: payload.email,
      role: payload.role,
    };

    return true;
  }

  /** Whether the token was blacklisted by `AuthService.logout`. */
  private async isBlacklisted(token: string): Promise<boolean> {
    let jwtManagementService: JwtManagementService | undefined;
    try {
      jwtManagementService = this.moduleRef?.get(JwtManagementService, {
        strict: false,
      });
    } catch {
      // AuthModule is not loaded (e.g. isolated tests); nothing to check.
      return false;
    }
    return jwtManagementService
      ? jwtManagementService.isTokenBlacklisted(token)
      : false;
  }

  /** Reload the user so deleted or suspended accounts lose access at once. */
  private async isUserActive(userId: string): Promise<boolean> {
    if (!this.dataSource) {
      return true;
    }

    const now = Date.now();
    const cached = this.userStatusCache.get(userId);
    if (cached && cached.expiresAt > now) {
      return cached.active;
    }

    const user = await this.dataSource.getRepository(User).findOne({
      where: { id: userId },
      select: { id: true, isActive: true, status: true },
    });
    const active =
      !!user && user.isActive !== false && user.status !== UserStatus.SUSPENDED;

    if (this.userStatusCache.size >= USER_STATUS_CACHE_MAX) {
      this.userStatusCache.clear();
    }
    this.userStatusCache.set(userId, {
      active,
      expiresAt: now + USER_STATUS_CACHE_MS,
    });
    return active;
  }

  private extractTokenFromHeader(request: Request): string | undefined {
    const authHeader = request.headers.authorization;
    if (!authHeader) {
      return undefined;
    }

    const [scheme, token] = authHeader.split(' ');
    return scheme === 'Bearer' ? token : undefined;
  }
}
