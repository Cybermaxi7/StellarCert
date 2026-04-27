export class AuthResponseDto {
  accessToken: string;
  refreshToken: string;
  expiresIn: number; // ✅ now dynamically set
}