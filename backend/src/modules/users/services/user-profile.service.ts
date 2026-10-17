import {
  Injectable,
  NotFoundException,
  ConflictException,
} from '@nestjs/common';
import { User, UserRole } from '../entities/user.entity';
import { UserRepository } from '../repositories/user.repository';
import { UpdateProfileDto } from '../dto/update-profile.dto';
import { IUserPublic } from '../interfaces/user.interface';
import { LoggingService } from '../../../common/logging/logging.service';
import { createHash } from 'crypto';

export const AUDIT_IP_RETENTION_DAYS = 90;

export interface UserDataExport {
  exportedAt: string;
  profile: IUserPublic;
  issuedCertificates: Record<string, unknown>[];
  receivedCertificates: Record<string, unknown>[];
  transfers: Record<string, unknown>[];
  notifications: Record<string, unknown>[];
}

export interface ErasureResult {
  message: string;
  anonymisedAt: string;
  purgedAuditIps: number;
}

@Injectable()
export class UserProfileService {
  constructor(
    private readonly userRepository: UserRepository,
    private readonly logger: LoggingService,
  ) {}

  async getProfile(userId: string): Promise<User> {
    const user = await this.userRepository.findById(userId);

    if (!user) {
      throw new NotFoundException('User not found');
    }

    return user;
  }

  async updateProfile(
    userId: string,
    updateProfileDto: UpdateProfileDto,
  ): Promise<User> {
    const user = await this.userRepository.findById(userId);

    if (!user) {
      throw new NotFoundException('User not found');
    }

    // Check if username is being changed and if it's already taken
    if (
      updateProfileDto.username &&
      updateProfileDto.username !== user.username
    ) {
      if (
        await this.userRepository.existsByUsername(updateProfileDto.username)
      ) {
        throw new ConflictException('Username already taken');
      }
    }

    // Check if Stellar public key is being changed and if it's already taken
    if (
      updateProfileDto.stellarPublicKey &&
      updateProfileDto.stellarPublicKey !== user.stellarPublicKey
    ) {
      if (
        await this.userRepository.existsByStellarPublicKey(
          updateProfileDto.stellarPublicKey,
        )
      ) {
        throw new ConflictException('Stellar public key already registered');
      }
    }

    const updatedUser = await this.userRepository.update(
      userId,
      updateProfileDto,
    );

    this.logger.log(`Profile updated for user: ${user.email}`);

    return updatedUser!;
  }

  async exportUserData(userId: string): Promise<UserDataExport> {
    const user = await this.userRepository.findById(userId);

    if (!user) {
      throw new NotFoundException('User not found');
    }

    const data = await this.userRepository.getExportableData(userId);

    this.logger.log(`Personal data exported for user: ${user.email}`);

    return {
      exportedAt: new Date().toISOString(),
      profile: this.toPublicUser(user),
      issuedCertificates: data.issuedCertificates,
      receivedCertificates: data.receivedCertificates,
      transfers: data.transfers,
      notifications: data.notifications,
    };
  }

  async deleteProfile(userId: string): Promise<ErasureResult> {
    const user = await this.userRepository.findById(userId);

    if (!user) {
      throw new NotFoundException('User not found');
    }

    const anonymisedAt = new Date();
    const anonymisedEmail = this.hashEmail(user.email);

    // Anonymise PII on the user record and deactivate the account.
    await this.userRepository.anonymise(userId, {
      email: anonymisedEmail,
      username: this.buildAnonymousUsername(userId),
      firstName: 'Anonymous',
      lastName: 'User',
      phone: null,
      profilePicture: null,
      isActive: false,
    });

    // Retain certificate records for chain integrity, but replace the recipient
    // email with its hash and strip other PII from the certificate payload.
    await this.userRepository.anonymiseCertificates(userId, anonymisedEmail);

    // Revoke verification tokens and purge audit IPs past the retention period.
    await this.userRepository.revokeVerificationTokens(userId);
    const purgedAuditIps = await this.userRepository.purgeAuditIpsBefore(
      userId,
      this.retentionCutoff(),
    );

    this.logger.log(
      `Account anonymised for user ${userId}; purged ${purgedAuditIps} audit IP(s).`,
    );

    return {
      message: 'Account anonymised and data erased successfully',
      anonymisedAt: anonymisedAt.toISOString(),
      purgedAuditIps,
    };
  }

  private retentionCutoff(): Date {
    const cutoff = new Date();
    cutoff.setDate(cutoff.getDate() - AUDIT_IP_RETENTION_DAYS);
    return cutoff;
  }

  private hashEmail(email: string): string {
    return createHash('sha256')
      .update(email.trim().toLowerCase())
      .digest('hex');
  }

  private buildAnonymousUsername(userId: string): string {
    const hash = createHash('sha256').update(userId).digest('hex');
    return `deleted-${hash.slice(0, 16)}`;
  }

  private toPublicUser(user: User): IUserPublic {
    return {
      id: user.id,
      email: user.email,
      username: user.username,
      firstName: user.firstName,
      lastName: user.lastName,
      profilePicture: user.profilePicture,
      role: user.role,
      stellarPublicKey: user.stellarPublicKey,
      isEmailVerified: user.isEmailVerified,
      createdAt: user.createdAt,
    };
  }
}
