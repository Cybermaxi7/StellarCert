/**
 * Issue #545: Email verification token stored in plaintext
 *
 * Root cause:
 * - User entity stores emailVerificationToken as a plain varchar column
 * - Contrast with passwordResetTokenHash which is bcrypt-hashed
 * - An attacker with DB read access can use stored tokens to verify
 *   arbitrary email addresses
 *
 * Fix: Add emailVerificationTokenHash column, hash the token with bcrypt
 *       before persisting, and compare hashed values on verification.
 */

// ---- FLAWED (user.entity.ts) ----
@Entity('users')
export class User {
  @Column({ nullable: true })
  emailVerificationToken: string;

  @Column({ type: 'timestamp', nullable: true })
  emailVerificationExpires: Date;

  isEmailVerificationTokenValid(): boolean {
    if (!this.emailVerificationToken || !this.emailVerificationExpires) {
      return false;
    }
    return new Date() < this.emailVerificationExpires;
  }
}

// ---- FIXED (user.entity.ts) ----
@Entity('users')
export class User {
  // Keep raw token only during the registration flow (never persisted)
  // Persist only the hash
  @Column({ nullable: true, select: false })
  emailVerificationTokenHash: string;

  @Column({ type: 'timestamp', nullable: true })
  emailVerificationExpires: Date;

  isEmailVerificationTokenValid(): boolean {
    // Expiry check does not need the hash; just the date
    return !!this.emailVerificationExpires && new Date() < this.emailVerificationExpires;
  }
}

// ---- FIXED (auth.service.ts — register flow) ----
import * as bcrypt from 'bcryptjs';

// During registration:
const rawToken = crypto.randomBytes(32).toString('hex');
const hashedToken = await bcrypt.hash(rawToken, 12);
await this.userRepository.update(user.id, {
  emailVerificationTokenHash: hashedToken,
  emailVerificationExpires: Date.now() + 24 * 60 * 60 * 1000, // 24h
});

// During verification:
const user = await this.userRepository.findOne({
  where: { id: userId },
  select: ['id', 'emailVerificationTokenHash', 'emailVerificationExpires'],
});
if (!user || !user.isEmailVerificationTokenValid()) {
  throw new Error('Invalid or expired verification token');
}
const matches = await bcrypt.compare(rawToken, user.emailVerificationTokenHash);
if (!matches) {
  throw new Error('Invalid verification token');
}
