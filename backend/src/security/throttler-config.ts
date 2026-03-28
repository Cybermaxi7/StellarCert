import { ThrottlerModuleOptions } from '@nestjs/throttler';

export const authThrottlerConfig: ThrottlerModuleOptions = [
  {
    name: 'login',
    ttl: 60000,
    limit: 5,
  },
  {
    name: 'registration',
    ttl: 3600000,
    limit: 3,
  },
];
