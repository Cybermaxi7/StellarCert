import { Module, MiddlewareConsumer, NestModule } from '@nestjs/common';
import { ConfigModule, ConfigService } from '@nestjs/config';
import { JwtModule } from '@nestjs/jwt';
import { BullModule } from '@nestjs/bull';
import { TypeOrmModule } from '@nestjs/typeorm';
import { LoggingService } from './logging/logging.service';
import { CorrelationIdMiddleware } from './logging/correlation-id.middleware';
import { MetricsService } from './monitoring/metrics.service';
import { SentryService } from './monitoring/sentry.service';
import { MetricsMiddleware } from './monitoring/metrics.middleware';
import { APP_GUARD, APP_INTERCEPTOR, APP_FILTER, APP_PIPE } from '@nestjs/core';
import { JwtAuthGuard } from './guards/jwt-auth.guard';
import { RolesGuard } from './guards/roles.guard';
import { ResponseInterceptor } from './interceptors/response.interceptor';
import { TimeoutInterceptor } from './interceptors/timeout.interceptor';
import { LoggingInterceptor } from './interceptors/logging.interceptor';
import { GlobalExceptionFilter } from './exceptions/global-exception.filter';
import { RequestValidationPipe } from '../modules/security/pipes/request-validation.pipe';
import {
  ValidationUtils,
  CryptoUtils,
  TransformUtils,
  StringUtils,
} from './utils';
import {
  RateLimitService,
  RATE_LIMIT_QUEUE_NAME,
} from './rate-limiting/rate-limit.service';
import { Issuer } from '../modules/issuers/entities/issuer.entity';

@Module({
  imports: [
    ConfigModule,
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
    TypeOrmModule.forFeature([Issuer]),
    BullModule.registerQueue({
      name: RATE_LIMIT_QUEUE_NAME,
      defaultJobOptions: {
        removeOnComplete: true,
        removeOnFail: false,
      },
    }),
  ],
  providers: [
    LoggingService,
    MetricsService,
    SentryService,
    RateLimitService,

    {
      provide: APP_GUARD,
      useClass: JwtAuthGuard,
    },
    {
      provide: APP_GUARD,
      useClass: RolesGuard,
    },

    {
      provide: APP_INTERCEPTOR,
      useClass: ResponseInterceptor,
    },
    {
      provide: APP_INTERCEPTOR,
      useClass: TimeoutInterceptor,
    },
    {
      provide: APP_INTERCEPTOR,
      useClass: LoggingInterceptor,
    },

    {
      provide: APP_FILTER,
      useClass: GlobalExceptionFilter,
    },

    {
      provide: APP_PIPE,
      useClass: RequestValidationPipe,
    },

    {
      provide: 'VALIDATION_UTILS',
      useValue: ValidationUtils,
    },
    {
      provide: 'CRYPTO_UTILS',
      useValue: CryptoUtils,
    },
    {
      provide: 'TRANSFORM_UTILS',
      useValue: TransformUtils,
    },
    {
      provide: 'STRING_UTILS',
      useValue: StringUtils,
    },
  ],
  exports: [
    LoggingService,
    MetricsService,
    SentryService,
    JwtModule,
    RateLimitService,
  ],
})
export class CommonModule implements NestModule {
  configure(consumer: MiddlewareConsumer) {
    consumer.apply(CorrelationIdMiddleware, MetricsMiddleware).forRoutes('*');
  }
}
