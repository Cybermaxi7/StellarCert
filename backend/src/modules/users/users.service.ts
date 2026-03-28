import {
  Injectable,
  NotFoundException,
  ConflictException,
  BadRequestException,
  UnauthorizedException,
  ForbiddenException,
  Logger,
} from '@nestjs/common';
import { JwtService } from '@nestjs/jwt';
import { ConfigService } from '@nestjs/config';
import * as bcrypt from 'bcryptjs';
import * as crypto from 'crypto';
import { User, UserRole, UserStatus } from './entities/user.entity';
import { UserRepository } from './repositories/user.repository';
import { CreateUserDto } from './dto/create-user.dto';
import { UpdateProfileDto } from './dto/update-profile.dto';
import {
  ChangePasswordDto,
  ForgotPasswordDto,
  ResetPasswordDto,
} from './dto/change-password.dto';
import { LoginUserDto, RefreshTokenDto } from './dto/login-user.dto';
import { UserFilterDto } from './dto/pagination.dto';
import {
  AdminUpdateUserDto,
  UpdateUserRoleDto,
  UpdateUserStatusDto,
  DeactivateUserDto,
} from './dto/admin-user.dto';
import {
  VerifyEmailDto,
  ResendVerificationDto,
} from './dto/email-verification.dto';
import { IPaginatedResult } from './interfaces';
import { IAuthTokens, IUserPublic } from './interfaces/user.interface';
import { CertificateStatsService } from '../certificate/services/stats.service';
import { AuditService } from '../audit/services/audit.service';
import { EmailQueueService } from '../email/email-queue.service';

@Injectable()
export class UsersService {
  private readonly logger = new Logger(UsersService.name);
  private readonly SALT_ROUNDS = 12;
  private readonly MAX_LOGIN_ATTEMPTS = 5;
  private readonly LOCK_TIME_MINUTES = 30;
  private readonly EMAIL_VERIFICATION_EXPIRY_HOURS = 24;
  private readonly PASSWORD_RESET_EXPIRY_HOURS = 1;

  constructor(
    private readonly userRepository: UserRepository,
    private readonly jwtService: JwtService,
    private readonly configService: ConfigService,
    private readonly certificateStatsService: CertificateStatsService,
    private readonly auditService: AuditService,
    private readonly emailQueueService: EmailQueueService,
  ) {}

  // ==================== Authentication ====================

  async register(
    createUserDto: CreateUserDto,
  ): Promise<{ user: IUserPublic; tokens: IAuthTokens }> {
    const { email, password, stellarPublicKey, username } = createUserDto;

    // Check if email already exists
    if (await this.userRepository.existsByEmail(email)) {
      throw new ConflictException('Email already registered');
    }

    // Check if username already exists (if provided)
    if (username && (await this.userRepository.existsByUsername(username))) {
      throw new ConflictException('Username already taken');
    }

    // Check if Stellar public key already exists (if provided)
    if (
      stellarPublicKey &&
      (await this.userRepository.existsByStellarPublicKey(stellarPublicKey))
    ) {
      throw new ConflictException('Stellar public key already registered');
    }

    // Hash password
    const hashedPassword = await bcrypt.hash(password, this.SALT_ROUNDS);

    // Generate email verification token
    const emailVerificationToken = this.generateToken();
    const emailVerificationExpires = new Date();
    emailVerificationExpires.setHours(
      emailVerificationExpires.getHours() +
        this.EMAIL_VERIFICATION_EXPIRY_HOURS,
    );

    // Create user
    const user = await this.userRepository.create({
      ...createUserDto,
      password: hashedPassword,
      emailVerificationToken,
      emailVerificationExpires,
      status: UserStatus.PENDING_VERIFICATION,
      role: createUserDto.role || UserRole.USER,
    });

    this.logger.log(`New user registered: ${user.email}`);

    // Generate tokens
    const tokens = await this.generateTokens(user);

    await this.queueVerificationEmail(user, emailVerificationToken);

    return {
      user: this.toPublicUser(user),
      tokens,
    };
  }

  async login(
    loginDto: LoginUserDto,
  ): Promise<{ user: IUserPublic; tokens: IAuthTokens }> {
    const { email, password } = loginDto;

    // Find user with password
    const user = await this.userRepository.findByEmailWithPassword(email);

    if (!user) {
      throw new UnauthorizedException('Invalid credentials');
    }

    // Check if account is locked
    if (user.isLocked()) {
      const remainingTime = Math.ceil(
        (user.lockedUntil.getTime() - Date.now()) / 60000,
      );
      throw new ForbiddenException(
        `Account is locked. Please try again in ${remainingTime} minutes`,
      );
    }

    // Check if account is active
    if (!user.isActive) {
      throw new ForbiddenException('Account is deactivated');
    }

    // Verify password
    const isPasswordValid = await bcrypt.compare(password, user.password);

    if (!isPasswordValid) {
      // Increment login attempts
      await this.userRepository.incrementLoginAttempts(user.id);

      // Check if should lock account
      if (user.loginAttempts + 1 >= this.MAX_LOGIN_ATTEMPTS) {
        const lockUntil = new Date();
        lockUntil.setMinutes(lockUntil.getMinutes() + this.LOCK_TIME_MINUTES);
        await this.userRepository.lockAccount(user.id, lockUntil);
        throw new ForbiddenException(
          `Too many failed attempts. Account locked for ${this.LOCK_TIME_MINUTES} minutes`,
        );
      }

      throw new UnauthorizedException('Invalid credentials');
    }

    // Reset login attempts on successful login
    await this.userRepository.resetLoginAttempts(user.id);

    // Update last login
    await this.userRepository.updateLastLogin(user.id);

    // Generate tokens
    const tokens = await this.generateTokens(user);

    this.logger.log(`User logged in: ${user.email}`);

    return {
      user: this.toPublicUser(user),
      tokens,
    };
  }

  async logout(userId: string): Promise<void> {
    await this.userRepository.update(userId, {
      refreshToken: undefined as any,
      refreshTokenExpires: undefined as any,
    });
    this.logger.log(`User logged out: ${userId}`);
  }

  async refreshTokens(refreshTokenDto: RefreshTokenDto): Promise<IAuthTokens> {
    const { refreshToken } = refreshTokenDto;

    // Verify refresh token signature and extract payload
    let payload: { sub: string } | null = null;
    try {
      const decoded = this.jwtService.verify(refreshToken, {
        secret: this.configService.get<string>('JWT_SECRET'),
      }) as Record<string, unknown>;

      if (!decoded || !decoded.sub || typeof decoded.sub !== 'string') {
        throw new UnauthorizedException('Invalid refresh token');
      }

      payload = { sub: decoded.sub };
    } catch {
      throw new UnauthorizedException('Invalid refresh token');
    }

    const userId = payload?.sub;
    if (!userId) {
      throw new UnauthorizedException('Invalid refresh token');
    }

    // Load user and validate stored refresh token hash
    const user = await this.userRepository.findById(userId);
    if (!user || !user.refreshToken) {
      throw new UnauthorizedException('Invalid refresh token');
    }

    const matches = await bcrypt.compare(refreshToken, user.refreshToken);
    if (!matches) {
      throw new UnauthorizedException('Invalid refresh token');
    }

    // Check if refresh token is expired
    if (user.refreshTokenExpires && user.refreshTokenExpires < new Date()) {
      throw new UnauthorizedException('Refresh token expired');
    }

    // Generate new tokens
    return this.generateTokens(user);
  }

  // ==================== Email Verification ====================

  async verifyEmail(
    verifyEmailDto: VerifyEmailDto,
  ): Promise<{ message: string }> {
    const { token } = verifyEmailDto;

    const user = await this.userRepository.findByEmailVerificationToken(token);

    if (!user) {
      throw new BadRequestException('Invalid verification token');
    }

    if (!user.isEmailVerificationTokenValid()) {
      throw new BadRequestException('Verification token has expired');
    }

    await this.userRepository.update(user.id, {
      isEmailVerified: true,
      emailVerificationToken: undefined as any,
      emailVerificationExpires: undefined as any,
      status: UserStatus.ACTIVE,
    });

    this.logger.log(`Email verified for user: ${user.email}`);

    return { message: 'Email verified successfully' };
  }

  async resendVerificationEmail(
    resendDto: ResendVerificationDto,
  ): Promise<{ message: string }> {
    const { email } = resendDto;

    const user = await this.userRepository.findByEmail(email);

    if (!user) {
      // Don't reveal if email exists
      return {
        message: 'If the email exists, a verification link has been sent',
      };
    }

    if (user.isEmailVerified) {
      throw new BadRequestException('Email is already verified');
    }

    // Generate new verification token
    const emailVerificationToken = this.generateToken();
    const emailVerificationExpires = new Date();
    emailVerificationExpires.setHours(
      emailVerificationExpires.getHours() +
        this.EMAIL_VERIFICATION_EXPIRY_HOURS,
    );

    await this.userRepository.update(user.id, {
      emailVerificationToken,
      emailVerificationExpires,
    });

    await this.queueVerificationEmail(user, emailVerificationToken);

    return {
      message: 'If the email exists, a verification link has been sent',
    };
  }

  // ==================== Password Management ====================

  async changePassword(
    userId: string,
    changePasswordDto: ChangePasswordDto,
  ): Promise<{ message: string }> {
    const { currentPassword, newPassword, confirmPassword } = changePasswordDto;

    if (newPassword !== confirmPassword) {
      throw new BadRequestException('Passwords do not match');
    }

    const user = await this.userRepository.findByIdWithPassword(userId);

    if (!user) {
      throw new NotFoundException('User not found');
    }

    // Verify current password
    const isPasswordValid = await bcrypt.compare(
      currentPassword,
      user.password,
    );

    if (!isPasswordValid) {
      throw new UnauthorizedException('Current password is incorrect');
    }

    // Hash new password
    const hashedPassword = await bcrypt.hash(newPassword, this.SALT_ROUNDS);

    await this.userRepository.update(userId, { password: hashedPassword });

    this.logger.log(`Password changed for user: ${user.email}`);

    return { message: 'Password changed successfully' };
  }

  async forgotPassword(
    forgotPasswordDto: ForgotPasswordDto,
  ): Promise<{ message: string }> {
    const { email } = forgotPasswordDto;

    const user = await this.userRepository.findByEmail(email);

    if (!user) {
      // Don't reveal if email exists
      return {
        message: 'If the email exists, a password reset link has been sent',
      };
    }

    // Generate password reset token
    const passwordResetToken = this.generateToken();
    const passwordResetExpires = new Date();
    passwordResetExpires.setHours(
      passwordResetExpires.getHours() + this.PASSWORD_RESET_EXPIRY_HOURS,
    );

    await this.userRepository.update(user.id, {
      passwordResetToken,
      passwordResetExpires,
    });

    await this.queuePasswordResetEmail(user, passwordResetToken);

    this.logger.log(`Password reset requested for: ${email}`);

    return {
      message: 'If the email exists, a password reset link has been sent',
    };
  }

  async resetPassword(
    resetPasswordDto: ResetPasswordDto,
  ): Promise<{ message: string }> {
    const { token, newPassword, confirmPassword } = resetPasswordDto;

    if (newPassword !== confirmPassword) {
      throw new BadRequestException('Passwords do not match');
    }

    const user = await this.userRepository.findByPasswordResetToken(token);

    if (!user) {
      throw new BadRequestException('Invalid reset token');
    }

    if (!user.isPasswordResetTokenValid()) {
      throw new BadRequestException('Reset token has expired');
    }

    // Hash new password
    const hashedPassword = await bcrypt.hash(newPassword, this.SALT_ROUNDS);

    await this.userRepository.update(user.id, {
      password: hashedPassword,
      passwordResetToken: undefined as any,
      passwordResetExpires: undefined as any,
    });

    this.logger.log(`Password reset completed for: ${user.email}`);

    return { message: 'Password reset successfully' };
  }

  // ==================== Profile Management ====================

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

  async deleteProfile(userId: string): Promise<{ message: string }> {
    const user = await this.userRepository.findById(userId);

    if (!user) {
      throw new NotFoundException('User not found');
    }

    // Soft delete
    await this.userRepository.softDelete(userId);

    this.logger.log(`Profile deleted (soft) for user: ${user.email}`);

    return { message: 'Account deactivated successfully' };
  }

  // ==================== Admin Operations ====================

  async findAllUsers(
    filterDto: UserFilterDto,
  ): Promise<IPaginatedResult<User>> {
    const { page, limit, sortBy, sortOrder, ...filters } = filterDto;

    return this.userRepository.findPaginated(
      { page: page || 1, limit: limit || 10 },
      filters,
      { field: sortBy || 'createdAt', order: sortOrder || 'DESC' },
    );
  }

  async findUserById(id: string): Promise<User> {
    const user = await this.userRepository.findById(id);

    if (!user) {
      throw new NotFoundException('User not found');
    }

    return user;
  }

  async adminUpdateUser(
    adminId: string,
    userId: string,
    updateDto: AdminUpdateUserDto,
  ): Promise<User> {
    // Prevent admin from modifying their own role
    if (adminId === userId && updateDto.role) {
      throw new ForbiddenException('Cannot modify your own role');
    }

    const user = await this.userRepository.findById(userId);

    if (!user) {
      throw new NotFoundException('User not found');
    }

    const updatedUser = await this.userRepository.update(userId, updateDto);

    this.logger.log(`Admin ${adminId} updated user ${userId}`);

    return updatedUser!;
  }

  async updateUserRole(
    adminId: string,
    userId: string,
    updateRoleDto: UpdateUserRoleDto,
  ): Promise<User> {
    // Prevent admin from modifying their own role
    if (adminId === userId) {
      throw new ForbiddenException('Cannot modify your own role');
    }

    const user = await this.userRepository.findById(userId);

    if (!user) {
      throw new NotFoundException('User not found');
    }

    const updatedUser = await this.userRepository.update(userId, {
      role: updateRoleDto.role,
    });

    this.logger.log(
      `Admin ${adminId} changed role of user ${userId} to ${updateRoleDto.role}`,
    );

    return updatedUser!;
  }

  async updateUserStatus(
    adminId: string,
    userId: string,
    updateStatusDto: UpdateUserStatusDto,
  ): Promise<User> {
    const user = await this.userRepository.findById(userId);

    if (!user) {
      throw new NotFoundException('User not found');
    }

    const updatedUser = await this.userRepository.update(userId, {
      status: updateStatusDto.status,
      isActive: updateStatusDto.status === UserStatus.ACTIVE,
    });

    this.logger.log(
      `Admin ${adminId} changed status of user ${userId} to ${updateStatusDto.status}`,
    );

    return updatedUser!;
  }

  async deactivateUser(
    adminId: string,
    userId: string,
    deactivateDto: DeactivateUserDto,
  ): Promise<User> {
    // Prevent admin from deactivating themselves
    if (adminId === userId) {
      throw new ForbiddenException('Cannot deactivate your own account');
    }

    const user = await this.userRepository.findById(userId);

    if (!user) {
      throw new NotFoundException('User not found');
    }

    const updatedUser = await this.userRepository.update(userId, {
      isActive: false,
      status: UserStatus.INACTIVE,
      metadata: {
        ...user.metadata,
        deactivationReason: deactivateDto.reason,
        deactivatedBy: adminId,
        deactivatedAt: new Date().toISOString(),
      },
    });

    this.logger.log(`Admin ${adminId} deactivated user ${userId}`);

    return updatedUser!;
  }

  async reactivateUser(adminId: string, userId: string): Promise<User> {
    const user = await this.userRepository.findById(userId);

    if (!user) {
      throw new NotFoundException('User not found');
    }

    const updatedUser = await this.userRepository.update(userId, {
      isActive: true,
      status: user.isEmailVerified
        ? UserStatus.ACTIVE
        : UserStatus.PENDING_VERIFICATION,
      metadata: {
        ...user.metadata,
        reactivatedBy: adminId,
        reactivatedAt: new Date().toISOString(),
      },
    });

    this.logger.log(`Admin ${adminId} reactivated user ${userId}`);

    return updatedUser!;
  }

  async deleteUser(
    adminId: string,
    userId: string,
  ): Promise<{ message: string }> {
    // Prevent admin from deleting themselves
    if (adminId === userId) {
      throw new ForbiddenException('Cannot delete your own account');
    }

    const user = await this.userRepository.findById(userId);

    if (!user) {
      throw new NotFoundException('User not found');
    }

    await this.userRepository.delete(userId);

    this.logger.log(`Admin ${adminId} permanently deleted user ${userId}`);

    return { message: 'User deleted successfully' };
  }

  // ==================== Issuer Profile Management ====================

  async getIssuerStats(userId: string): Promise<any> {
    const user = await this.userRepository.findById(userId);
    if (!user) {
      throw new NotFoundException('User not found');
    }

    if (user.role !== UserRole.ISSUER && user.role !== UserRole.ADMIN) {
      throw new ForbiddenException(
        'Only issuers and admins can access issuer stats',
      );
    }

    // Get real statistics from certificate service
    const stats = await this.certificateStatsService.getStatistics({
      issuerId: userId,
    });

    return {
      totalCertificates: stats.totalCertificates,
      activeCertificates: stats.activeCertificates,
      revokedCertificates: stats.revokedCertificates,
      expiredCertificates: stats.expiredCertificates,
      totalVerifications: stats.verificationStats?.totalVerifications || 0,
      lastLogin: user.lastLoginAt || user.updatedAt,
    };
  }

  async getIssuerActivity(
    userId: string,
    page: number = 1,
    limit: number = 10,
  ): Promise<any> {
    const user = await this.userRepository.findById(userId);
    if (!user) {
      throw new NotFoundException('User not found');
    }

    if (user.role !== UserRole.ISSUER && user.role !== UserRole.ADMIN) {
      throw new ForbiddenException(
        'Only issuers and admins can access activity logs',
      );
    }

    // Get real activity data from audit service
    const skip = (page - 1) * limit;
    const { data: activities, total } = await this.auditService.search({
      userId,
      skip,
      take: limit,
    });

    // Transform audit logs to match expected format
    const transformedActivities = activities.map((activity) => ({
      id: activity.id,
      action: activity.action,
      description: this.generateActivityDescription(activity),
      ipAddress: activity.ipAddress,
      userAgent: activity.userAgent,
      timestamp: new Date(activity.timestamp).toISOString(),
    }));

    const totalPages = Math.ceil(total / limit);

    return {
      activities: transformedActivities,
      meta: {
        total,
        page,
        limit,
        totalPages,
      },
    };
  }

  private generateActivityDescription(activity: any): string {
    switch (activity.action) {
      case 'ISSUE_CERTIFICATE':
        return `Issued certificate "${activity.resourceData?.title || activity.resourceId}"`;
      case 'REVOKE_CERTIFICATE':
        return `Revoked certificate #${activity.resourceId}`;
      case 'UPDATE_PROFILE':
        return 'Updated profile information';
      case 'LOGIN':
        return 'Logged into account';
      case 'LOGOUT':
        return 'Logged out of account';
      case 'CREATE_USER':
        return 'Created new user account';
      case 'UPDATE_USER':
        return 'Updated user information';
      case 'DELETE_USER':
        return 'Deleted user account';
      default:
        return `Performed ${activity.action.toLowerCase()} on ${activity.resourceType}`;
    }
  }

  async updateIssuerProfile(userId: string, updateDto: any): Promise<any> {
    const user = await this.userRepository.findById(userId);
    if (!user) {
      throw new NotFoundException('User not found');
    }

    if (user.role !== UserRole.ISSUER && user.role !== UserRole.ADMIN) {
      throw new ForbiddenException(
        'Only issuers and admins can update issuer profile',
      );
    }

    // Check if username is already taken (if updating)
    if (updateDto.username && updateDto.username !== user.username) {
      if (await this.userRepository.existsByUsername(updateDto.username)) {
        throw new ConflictException('Username already taken');
      }
    }

    // Check if Stellar public key is already taken (if updating)
    if (
      updateDto.stellarPublicKey &&
      updateDto.stellarPublicKey !== user.stellarPublicKey
    ) {
      if (
        await this.userRepository.existsByStellarPublicKey(
          updateDto.stellarPublicKey,
        )
      ) {
        throw new ConflictException('Stellar public key already registered');
      }
    }

    // Update user fields
    const updateData: any = {};
    if (updateDto.firstName) updateData.firstName = updateDto.firstName;
    if (updateDto.lastName) updateData.lastName = updateDto.lastName;
    if (updateDto.username) updateData.username = updateDto.username;
    if (updateDto.phone) updateData.phone = updateDto.phone;
    if (updateDto.profilePicture)
      updateData.profilePicture = updateDto.profilePicture;
    if (updateDto.stellarPublicKey)
      updateData.stellarPublicKey = updateDto.stellarPublicKey;

    // Update metadata if organization is provided
    if (updateDto.organization !== undefined) {
      updateData.metadata = {
        ...user.metadata,
        organization: updateDto.organization,
      };
    }

    const updatedUser = await this.userRepository.update(userId, updateData);

    this.logger.log(`User ${userId} updated issuer profile`);

    return updatedUser;
  }

  // ==================== Statistics ====================

  async getUserStats(): Promise<{
    total: number;
    active: number;
    byRole: Record<UserRole, number>;
    byStatus: Record<UserStatus, number>;
    certificateIssuanceCounts: Record<string, number>;
  }> {
    const [total, active, userCount, issuerCount, adminCount] =
      await Promise.all([
        this.userRepository.countTotal(),
        this.userRepository.countActive(),
        this.userRepository.countByRole(UserRole.USER),
        this.userRepository.countByRole(UserRole.ISSUER),
        this.userRepository.countByRole(UserRole.ADMIN),
      ]);

    const [activeStatus, inactiveStatus, suspendedStatus, pendingStatus] =
      await Promise.all([
        this.userRepository.countByStatus(UserStatus.ACTIVE),
        this.userRepository.countByStatus(UserStatus.INACTIVE),
        this.userRepository.countByStatus(UserStatus.SUSPENDED),
        this.userRepository.countByStatus(UserStatus.PENDING_VERIFICATION),
      ]);

    const certificateIssuanceCounts =
      await this.userRepository.getPerUserCertificateCounts();

    return {
      total,
      active,
      byRole: {
        [UserRole.USER]: userCount,
        [UserRole.ISSUER]: issuerCount,
        [UserRole.ADMIN]: adminCount,
      },
      byStatus: {
        [UserStatus.ACTIVE]: activeStatus,
        [UserStatus.INACTIVE]: inactiveStatus,
        [UserStatus.SUSPENDED]: suspendedStatus,
        [UserStatus.PENDING_VERIFICATION]: pendingStatus,
      },
      certificateIssuanceCounts,
    };
  }

  // ==================== Helper Methods ====================

  async findOneByEmail(email: string): Promise<User | undefined> {
    const user = await this.userRepository.findByEmail(email);
    return user || undefined;
  }

  async findOneById(id: string): Promise<User | undefined> {
    const user = await this.userRepository.findById(id);
    return user || undefined;
  }

  async create(userData: Partial<User>): Promise<User> {
    return this.userRepository.create(userData);
  }

  async update(id: string, userData: Partial<User>): Promise<User | undefined> {
    const user = await this.userRepository.update(id, userData);
    return user || undefined;
  }

  async remove(id: string): Promise<void> {
    await this.userRepository.delete(id);
  }

  private async generateTokens(user: User): Promise<IAuthTokens> {
    const payload = {
      sub: user.id,
      email: user.email,
      role: user.role,
    };

    const accessToken = this.jwtService.sign(payload, {
      expiresIn: this.configService.get('JWT_EXPIRES_IN', '1h'),
    });

    const refreshToken = this.jwtService.sign(payload, {
      expiresIn: '7d',
    });

    // Store refresh token
    const refreshTokenExpires = new Date();
    refreshTokenExpires.setDate(refreshTokenExpires.getDate() + 7);

    const hashedRefreshToken = await bcrypt.hash(
      refreshToken,
      this.SALT_ROUNDS,
    );

    await this.userRepository.update(user.id, {
      refreshToken: hashedRefreshToken,
      refreshTokenExpires,
    });

    return {
      accessToken,
      refreshToken,
      expiresIn: 3600, // 1 hour in seconds
    };
  }

  private generateToken(): string {
    return crypto.randomBytes(32).toString('hex');
  }

  private async queueVerificationEmail(
    user: User,
    emailVerificationToken: string,
  ): Promise<void> {
    try {
      await this.emailQueueService.queueVerificationEmail({
        to: user.email,
        userName: this.getUserDisplayName(user),
        verificationLink: this.buildVerificationLink(emailVerificationToken),
      });
    } catch (error) {
      const message = error instanceof Error ? error.message : String(error);
      this.logger.error(
        `Failed to queue verification email for ${user.email}: ${message}`,
      );
    }
  }

  private async queuePasswordResetEmail(
    user: User,
    passwordResetToken: string,
  ): Promise<void> {
    try {
      await this.emailQueueService.queuePasswordReset({
        to: user.email,
        userName: this.getUserDisplayName(user),
        resetLink: this.buildPasswordResetLink(passwordResetToken),
      });
    } catch (error) {
      const message = error instanceof Error ? error.message : String(error);
      this.logger.error(
        `Failed to queue password reset email for ${user.email}: ${message}`,
      );
    }
  }

  private buildVerificationLink(token: string): string {
    return this.buildAppLink('/verify-email', token);
  }

  private buildPasswordResetLink(token: string): string {
    return this.buildAppLink('/reset-password', token);
  }

  private buildAppLink(path: string, token: string): string {
    const appUrl =
      this.configService.get<string>('APP_URL') ||
      this.configService.get<string>('ALLOWED_ORIGINS')?.split(',')[0] ||
      'http://localhost:5173';

    const normalizedBaseUrl = appUrl.replace(/\/+$/, '');
    const normalizedPath = path.startsWith('/') ? path : `/${path}`;

    return `${normalizedBaseUrl}${normalizedPath}?token=${encodeURIComponent(token)}`;
  }

  private getUserDisplayName(user: User): string {
    return (
      `${user.firstName ?? ''} ${user.lastName ?? ''}`.trim() || user.email
    );
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
