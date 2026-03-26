import {
  Controller,
  Get,
  Query,
  UseGuards,
  Param,
  Post,
  Body,
  Patch,
  Res,
} from '@nestjs/common';
import { CertificateService } from './certificate.service';
import {
  ApiTags,
  ApiOperation,
  ApiResponse,
  ApiBearerAuth,
} from '@nestjs/swagger';
import { CertificateStatsDto } from './dto/stats.dto';
import { CertificateStatsService } from './services/stats.service';
import { JwtAuthGuard } from 'src/common';
import { RolesGuard } from '../../common/guards/roles.guard';
import { Roles } from '../../common/decorators/roles.decorator';
import { UserRole } from '../../common/constants/roles';
import { CurrentUser } from '../../common/decorators/current-user.decorator';
import { CreateCertificateDto } from './dto/create-certificate.dto';
import { CertificateQrResponseDto } from './dto/certificate-qr-response.dto';

@ApiTags('Certificates')
@Controller('certificates')
@ApiBearerAuth()
export class CertificateController {
  constructor(
    private readonly certificateService: CertificateService,
    private readonly statsService: CertificateStatsService,
  ) {}

  @Get()
  @UseGuards(JwtAuthGuard, RolesGuard)
  @Roles(UserRole.ADMIN, UserRole.ISSUER)
  @ApiOperation({ summary: 'List certificates' })
  async findAll(
    @Query('page') page = 1,
    @Query('limit') limit = 10,
    @Query('issuerId') issuerId?: string,
    @Query('status') status?: string,
  ) {
    return this.certificateService.findAll(page, limit, issuerId, status);
  }

  @Get('stats/summary')
  @ApiOperation({ summary: 'Get public certificate summary statistics' })
  async getPublicSummary(): Promise<Partial<CertificateStatsDto>> {
    return this.statsService.getPublicSummary();
  }

  @Get(':id/qr')
  @ApiOperation({ summary: 'Get QR code URL for a certificate' })
  @ApiResponse({
    status: 200,
    description: 'QR code generated successfully',
    type: CertificateQrResponseDto,
  })
  @ApiResponse({ status: 404, description: 'Certificate not found' })
  async getQrCode(@Param('id') id: string): Promise<CertificateQrResponseDto> {
    return this.certificateService.getCertificateQrCode(id);
  }

  @Get(':id')
  @ApiOperation({ summary: 'Get certificate by ID' })
  async findOne(@Param('id') id: string) {
    return this.certificateService.findOne(id);
  }

  @Post()
  @UseGuards(JwtAuthGuard, RolesGuard)
  @Roles(UserRole.ISSUER, UserRole.ADMIN)
  @ApiOperation({ summary: 'Create new certificate' })
  async create(
    @Body() dto: CreateCertificateDto,
    @CurrentUser('sub') issuerId: string,
  ) {
    dto.issuerId = issuerId;
    return this.certificateService.create(dto);
  }

  @Patch(':id/revoke')
  @UseGuards(JwtAuthGuard, RolesGuard)
  @Roles(UserRole.ISSUER, UserRole.ADMIN)
  @ApiOperation({ summary: 'Revoke certificate' })
  async revoke(
    @Param('id') id: string,
    @Body('reason') reason?: string,
    @CurrentUser('sub') issuerId?: string,
    @CurrentUser('role') userRole?: string,
  ) {
    return this.certificateService.revoke(id, reason, issuerId, userRole);
  }

  @Patch(':id/freeze')
  @UseGuards(JwtAuthGuard, RolesGuard)
  @Roles(UserRole.ISSUER, UserRole.ADMIN)
  @ApiOperation({ summary: 'Freeze certificate' })
  async freeze(@Param('id') id: string, @Body('reason') reason?: string) {
    return this.certificateService.freeze(id, reason);
  }

  @Patch(':id/unfreeze')
  @UseGuards(JwtAuthGuard, RolesGuard)
  @Roles(UserRole.ISSUER, UserRole.ADMIN)
  @ApiOperation({ summary: 'Unfreeze certificate' })
  async unfreeze(@Param('id') id: string, @Body('reason') reason?: string) {
    return this.certificateService.unfreeze(id, reason);
  }

  @Post('bulk-revoke')
  @UseGuards(JwtAuthGuard, RolesGuard)
  @Roles(UserRole.ISSUER, UserRole.ADMIN)
  @ApiOperation({ summary: 'Bulk revoke certificates' })
  async bulkRevoke(
    @Body('certificateIds') certificateIds: string[],
    @Body('reason') reason?: string,
    @CurrentUser('sub') issuerId?: string,
    @CurrentUser('role') userRole?: string,
  ) {
    return this.certificateService.bulkRevoke(
      certificateIds,
      reason,
      issuerId,
      userRole,
    );
  }

  @Get('export')
  @UseGuards(JwtAuthGuard, RolesGuard)
  @Roles(UserRole.ISSUER, UserRole.ADMIN)
  @ApiOperation({ summary: 'Export certificates' })
  async exportCertificates(
    @Query('issuerId') issuerId?: string,
    @Query('status') status?: string,
  ) {
    return this.certificateService.exportCertificates(issuerId, status);
  }
}
