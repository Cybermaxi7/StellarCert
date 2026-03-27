import {
  Controller,
  Post,
  Body,
  HttpCode,
  HttpStatus,
  Version,
} from '@nestjs/common';
import { ApiTags, ApiOperation, ApiResponse } from '@nestjs/swagger';
import { AuthService } from '../auth.service';
import { LoginDto } from '../dto/login.dto';
import { RegisterDto } from '../dto/register.dto';
import { AuthResponseDto } from '../dto/auth-response.dto';
import { Public } from '../../../common/decorators/public.decorator';

/**
 * Version 2 of the Authentication API
 *
 * Changes from V1:
 * - Enhanced response with additional metadata
 * - Improved error handling
 * - Support for refresh tokens
 */
@ApiTags('Authentication v2')
@Controller({ path: 'auth', version: '2' })
export class AuthV2Controller {
  constructor(private authService: AuthService) {}

  @Post('login')
  @Public()
  @HttpCode(HttpStatus.OK)
  @ApiOperation({ summary: 'Login user (v2) - Enhanced with metadata' })
  @ApiResponse({ status: HttpStatus.OK, type: AuthResponseDto })
  async login(@Body() loginDto: LoginDto): Promise<AuthResponseDto> {
    const result = await this.authService.login(loginDto);

    // V2 enhancement: Add metadata
    return {
      ...result,
      metadata: {
        version: '2',
        timestamp: new Date().toISOString(),
        expiresIn: 3600,
      },
    };
  }

  @Post('register')
  @Public()
  @HttpCode(HttpStatus.CREATED)
  @ApiOperation({ summary: 'Register new user (v2) - Enhanced with metadata' })
  @ApiResponse({ status: HttpStatus.CREATED, type: AuthResponseDto })
  async register(@Body() registerDto: RegisterDto): Promise<AuthResponseDto> {
    const result = await this.authService.register(registerDto);

    // V2 enhancement: Add metadata
    return {
      ...result,
      metadata: {
        version: '2',
        timestamp: new Date().toISOString(),
        expiresIn: 3600,
      },
    };
  }
}
