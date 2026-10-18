import {
  ForbiddenException,
  Injectable,
  NotFoundException,
} from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import * as bcrypt from 'bcrypt';
import { IsNull, Repository } from 'typeorm';
import { User } from '../../users/entities/user.entity';
import { AuthSession } from '../entities/auth-session.entity';

export interface SessionView {
  id: string;
  device: string | null;
  ipAddress: string | null;
  userAgent: string | null;
  createdAt: Date;
  lastUsedAt: Date;
  current: boolean;
}

@Injectable()
export class SessionsService {
  constructor(
    @InjectRepository(AuthSession)
    private readonly sessions: Repository<AuthSession>,
    @InjectRepository(User)
    private readonly users: Repository<User>,
  ) {}

  async createSession(
    userId: string,
    rawRefreshToken: string,
    meta: { device?: string; ipAddress?: string; userAgent?: string } = {},
  ): Promise<AuthSession> {
    const refreshTokenHash = await bcrypt.hash(rawRefreshToken, 12);
    const session = this.sessions.create({
      userId,
      refreshTokenHash,
      device: meta.device ?? null,
      ipAddress: meta.ipAddress ?? null,
      userAgent: meta.userAgent ?? null,
      lastUsedAt: new Date(),
    });
    return this.sessions.save(session);
  }

  async touchByRefreshToken(rawRefreshToken: string): Promise<AuthSession | null> {
    const active = await this.sessions.find({
      where: { revokedAt: IsNull() },
      order: { lastUsedAt: 'DESC' },
      take: 50,
    });
    for (const s of active) {
      if (await bcrypt.compare(rawRefreshToken, s.refreshTokenHash)) {
        s.lastUsedAt = new Date();
        return this.sessions.save(s);
      }
    }
    return null;
  }

  async listForUser(
    userId: string,
    currentRefreshToken?: string,
  ): Promise<SessionView[]> {
    const rows = await this.sessions.find({
      where: { userId, revokedAt: IsNull() },
      order: { lastUsedAt: 'DESC' },
    });
    const views: SessionView[] = [];
    for (const s of rows) {
      let current = false;
      if (currentRefreshToken) {
        current = await bcrypt.compare(currentRefreshToken, s.refreshTokenHash);
      }
      views.push({
        id: s.id,
        device: s.device,
        ipAddress: s.ipAddress,
        userAgent: s.userAgent,
        createdAt: s.createdAt,
        lastUsedAt: s.lastUsedAt,
        current,
      });
    }
    return views;
  }

  async revokeSession(userId: string, sessionId: string): Promise<void> {
    const session = await this.sessions.findOne({ where: { id: sessionId } });
    if (!session || session.userId !== userId) {
      throw new NotFoundException('Session not found');
    }
    if (!session.revokedAt) {
      session.revokedAt = new Date();
      await this.sessions.save(session);
    }
  }

  /**
   * Revoke every session and bump tokenVersion so access tokens fail JWT checks.
   */
  async revokeAll(userId: string): Promise<number> {
    const result = await this.sessions
      .createQueryBuilder()
      .update(AuthSession)
      .set({ revokedAt: () => 'CURRENT_TIMESTAMP' })
      .where('"userId" = :userId', { userId })
      .andWhere('"revokedAt" IS NULL')
      .execute();

    await this.users.increment({ id: userId }, 'tokenVersion', 1);
    await this.users.update(userId, { refreshToken: null });

    return result.affected ?? 0;
  }
}
