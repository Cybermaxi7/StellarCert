import { Module } from '@nestjs/common';
import { ThrottlerModule } from '@nestjs/throttler';
import { authThrottlerConfig } from './throttler-config';

@Module({
  imports: [
    ThrottlerModule.forRoot(authThrottlerConfig),
  ],
  exports: [ThrottlerModule],
})
export class AuthSecurityModule {}
