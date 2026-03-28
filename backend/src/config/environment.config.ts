import { plainToClass } from 'class-transformer';
import {
  IsEnum,
  IsNumber,
  IsString,
  validateSync,
  IsOptional,
  IsBoolean,
} from 'class-validator';

export const CERTIFICATE_EXPIRY_WINDOW_DAYS =
  process.env.CERTIFICATE_EXPIRY_WINDOW_DAYS || '0';
export const STELLAR_SEQUENCE_THRESHOLD =
  process.env.STELLAR_SEQUENCE_THRESHOLD || '';

enum Environment {
  Development = 'development',
  Production = 'production',
  Test = 'test',
}

class EnvironmentVariables {
  @IsEnum(Environment)
  NODE_ENV: Environment;

  @IsNumber()
  PORT: number;

  @IsString()
  DB_HOST: string;

  @IsNumber()
  DB_PORT: number;

  @IsString()
  DB_USERNAME: string;

  @IsString()
  DB_PASSWORD: string;

  @IsString()
  DB_NAME: string;

  @IsString()
  JWT_SECRET: string;

  @IsString()
  JWT_EXPIRES_IN: string;

  @IsString()
  STELLAR_NETWORK: string;

  @IsString()
  STELLAR_HORIZON_URL: string;

  @IsString()
  STELLAR_ISSUER_SECRET_KEY: string;

  @IsString()
  STELLAR_ISSUER_PUBLIC_KEY: string;

  @IsString()
  ALLOWED_ORIGINS: string;

  @IsOptional()
  @IsString()
  SENTRY_DSN?: string;

  @IsOptional()
  @IsBoolean()
  ENABLE_SENTRY?: boolean;

  // Email Configuration
  @IsOptional()
  @IsString()
  EMAIL_SERVICE?: string;

  @IsOptional()
  @IsString()
  EMAIL_HOST?: string;

  @IsOptional()
  @IsNumber()
  EMAIL_PORT?: number;

  @IsOptional()
  @IsString()
  EMAIL_USERNAME?: string;

  @IsOptional()
  @IsString()
  EMAIL_PASSWORD?: string;

  @IsOptional()
  @IsString()
  EMAIL_FROM?: string;

  @IsOptional()
  @IsString()
  SENDGRID_API_KEY?: string;

  @IsOptional()
  @IsString()
  REDIS_URL?: string;

  // Storage Configuration
  @IsOptional()
  @IsString()
  STORAGE_ENDPOINT?: string;

  @IsOptional()
  @IsString()
  STORAGE_REGION?: string;

  @IsOptional()
  @IsString()
  STORAGE_ACCESS_KEY?: string;

  @IsOptional()
  @IsString()
  STORAGE_SECRET_KEY?: string;

  @IsOptional()
  @IsString()
  STORAGE_BUCKET?: string;

  @IsOptional()
  @IsBoolean()
  STORAGE_REQUIRED?: boolean;

  @IsOptional()
  @IsNumber()
  AUDIT_RETENTION_DAYS?: number;

  @IsOptional()
  @IsString()
  REQUEST_SIZE_LIMIT?: string;

  @IsOptional()
  @IsNumber()
  RATE_LIMIT_DEFAULT_WINDOW_MS?: number;

  @IsOptional()
  @IsNumber()
  RATE_LIMIT_DEFAULT_MAX_REQUESTS?: number;

  @IsOptional()
  @IsNumber()
  AUTH_BRUTE_FORCE_WINDOW_MS?: number;

  @IsOptional()
  @IsNumber()
  AUTH_BRUTE_FORCE_MAX_ATTEMPTS?: number;

  @IsOptional()
  @IsString()
  SECURITY_CSP?: string;

  @IsOptional()
  @IsString()
  SECURITY_FORCE_HSTS?: string;
}

export function validateEnv(): EnvironmentVariables {
  const validatedEnv = plainToClass(
    EnvironmentVariables,
    {
      NODE_ENV: process.env.NODE_ENV || 'development',
      PORT: process.env.PORT ? parseInt(process.env.PORT, 10) : 3000,
      DB_HOST: process.env.DB_HOST || 'localhost',
      DB_PORT: process.env.DB_PORT ? parseInt(process.env.DB_PORT, 10) : 5432,
      DB_USERNAME: process.env.DB_USERNAME || 'postgres',
      DB_PASSWORD: process.env.DB_PASSWORD || 'password',
      DB_NAME: process.env.DB_NAME || 'stellarcert',
      JWT_SECRET: process.env.JWT_SECRET,
      JWT_EXPIRES_IN: process.env.JWT_EXPIRES_IN || '24h',
      STELLAR_NETWORK: process.env.STELLAR_NETWORK || 'testnet',
      STELLAR_HORIZON_URL:
        process.env.STELLAR_HORIZON_URL ||
        'https://horizon-testnet.stellar.org',
      STELLAR_ISSUER_SECRET_KEY: process.env.STELLAR_ISSUER_SECRET_KEY || '',
      STELLAR_ISSUER_PUBLIC_KEY: process.env.STELLAR_ISSUER_PUBLIC_KEY || '',
      ALLOWED_ORIGINS: process.env.ALLOWED_ORIGINS || 'http://localhost:5173',
      SENTRY_DSN: process.env.SENTRY_DSN,
      ENABLE_SENTRY: process.env.ENABLE_SENTRY === 'true',
      EMAIL_SERVICE: process.env.EMAIL_SERVICE,
      EMAIL_HOST: process.env.EMAIL_HOST,
      EMAIL_PORT: process.env.EMAIL_PORT
        ? parseInt(process.env.EMAIL_PORT, 10)
        : undefined,
      EMAIL_USERNAME: process.env.EMAIL_USERNAME,
      EMAIL_PASSWORD: process.env.EMAIL_PASSWORD,
      EMAIL_FROM: process.env.EMAIL_FROM,
      SENDGRID_API_KEY: process.env.SENDGRID_API_KEY,
      REDIS_URL: process.env.REDIS_URL,
      STORAGE_ENDPOINT: process.env.STORAGE_ENDPOINT,
      STORAGE_REGION: process.env.STORAGE_REGION,
      STORAGE_ACCESS_KEY: process.env.STORAGE_ACCESS_KEY,
      STORAGE_SECRET_KEY: process.env.STORAGE_SECRET_KEY,
      STORAGE_BUCKET: process.env.STORAGE_BUCKET,
      STORAGE_REQUIRED: process.env.STORAGE_REQUIRED !== 'false',
      AUDIT_RETENTION_DAYS: process.env.AUDIT_RETENTION_DAYS
        ? parseInt(process.env.AUDIT_RETENTION_DAYS, 10)
        : undefined,
      REQUEST_SIZE_LIMIT: process.env.REQUEST_SIZE_LIMIT,
      RATE_LIMIT_DEFAULT_WINDOW_MS: process.env.RATE_LIMIT_DEFAULT_WINDOW_MS
        ? parseInt(process.env.RATE_LIMIT_DEFAULT_WINDOW_MS, 10)
        : undefined,
      RATE_LIMIT_DEFAULT_MAX_REQUESTS: process.env
        .RATE_LIMIT_DEFAULT_MAX_REQUESTS
        ? parseInt(process.env.RATE_LIMIT_DEFAULT_MAX_REQUESTS, 10)
        : undefined,
      AUTH_BRUTE_FORCE_WINDOW_MS: process.env.AUTH_BRUTE_FORCE_WINDOW_MS
        ? parseInt(process.env.AUTH_BRUTE_FORCE_WINDOW_MS, 10)
        : undefined,
      AUTH_BRUTE_FORCE_MAX_ATTEMPTS: process.env.AUTH_BRUTE_FORCE_MAX_ATTEMPTS
        ? parseInt(process.env.AUTH_BRUTE_FORCE_MAX_ATTEMPTS, 10)
        : undefined,
      SECURITY_CSP: process.env.SECURITY_CSP,
      SECURITY_FORCE_HSTS: process.env.SECURITY_FORCE_HSTS,
    },
    { enableImplicitConversion: true },
  );

  const errors = validateSync(validatedEnv);

  if (errors.length > 0) {
    throw new Error(errors.toString());
  }

  return validatedEnv;
}
