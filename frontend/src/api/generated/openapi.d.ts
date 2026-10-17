/* Fallback schema; refreshed by scripts/generate-api-types.mjs when available. */
export interface components {
  schemas: {
    UserResponseDto: {
      id: string;
      email: string;
      username?: string;
      firstName: string;
      lastName: string;
      phone?: string;
      profilePicture?: string;
      role: 'admin' | 'issuer' | 'user' | 'auditor' | 'recipient' | 'verifier';
      status: string;
      stellarPublicKey?: string;
      isEmailVerified: boolean;
      isActive: boolean;
      lastLoginAt?: string;
      createdAt: string;
      updatedAt: string;
    };
  };
}

export interface operations {}

export interface paths {}
