import { Module, forwardRef } from '@nestjs/common';
import { ConfigModule, ConfigService } from '@nestjs/config';
import { JwtModule } from '@nestjs/jwt';
import { PassportModule } from '@nestjs/passport';
import { TypeOrmModule } from '@nestjs/typeorm';
import { AuthService } from './auth.service';
import { AuthController } from './auth.controller';
import { JwtStrategy } from './strategies/jwt.strategy';
import { JwtManagementService } from './services/jwt.service';
import { TwoFactorService } from './services/two-factor.service';
import { UsersModule } from '../users/users.module';
import { User } from '../users/entities/user.entity';
import { CacheModule } from '@nestjs/cache-manager';

@Module({
  imports: [
    CacheModule.register(),
    ConfigModule,
    PassportModule,
    TypeOrmModule.forFeature([User]),
    JwtModule.registerAsync({
      imports: [ConfigModule],
      inject: [ConfigService],
      useFactory: (configService: ConfigService) => {
        const secret = configService.get<string>('JWT_SECRET');
        const expiresIn = (configService.get<string>('JWT_EXPIRES_IN') ||
          '24h') as any;

        if (!secret) {
          throw new Error('JWT_SECRET must be configured');
        }

        return {
          secret,
          signOptions: {
            expiresIn,
          },
        };
      },
    }),
    forwardRef(() => UsersModule),
  ],
  controllers: [AuthController],
  providers: [AuthService, JwtStrategy, JwtManagementService, TwoFactorService],
  exports: [AuthService, JwtModule, JwtManagementService, TwoFactorService],
})
export class AuthModule {}
