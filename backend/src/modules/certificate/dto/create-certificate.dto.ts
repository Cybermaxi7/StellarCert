import {
  IsString,
  IsEmail,
  IsOptional,
  IsUUID,
  IsDate,
  IsObject,
} from 'class-validator';
import { Type } from 'class-transformer';

export class CreateCertificateDto {
  @IsOptional()
  @IsUUID()
  issuerId: string;

  @IsEmail()
  recipientEmail: string;

  @IsString()
  recipientName: string;

  @IsString()
  title: string;

  @IsOptional()
  @IsString()
  description?: string;

  @IsOptional()
  @IsString()
  verificationCode?: string;

  @IsOptional()
  @Type(() => Date)
  expiresAt?: Date;

  @IsOptional()
  @IsUUID()
  metadataSchemaId?: string;

  @IsOptional()
  @IsObject()
  metadata?: Record<string, any>;
}
