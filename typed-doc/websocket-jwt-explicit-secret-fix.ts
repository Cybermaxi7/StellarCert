/**
 * Issue #549: WebSocket JWT verification uses default secret
 *
 * Root cause:
 * - NotificationsGateway.handleConnection calls this.jwtService.verify(token)
 *   without passing an explicit secret
 * - This relies on the JwtModule's default secret (JWT_ACCESS_SECRET)
 * - If the module's default secret changes or is overridden, the gateway
 *   silently uses the wrong key, creating a security gap
 *
 * Fix: Inject ConfigService and pass the access secret explicitly
 *      in the verify call.
 */

// ---- FLAWED (notifications.gateway.ts) ----
@WebSocketGateway({ cors: { origin: '*' } })
export class NotificationsGateway implements OnGatewayConnection, OnGatewayDisconnect {
  constructor(
    private readonly jwtService: JwtService,
    private readonly logger: LoggingService,
  ) {}

  async handleConnection(client: Socket) {
    try {
      const token = client.handshake.auth?.token
        ?? client.handshake.headers?.authorization?.split(' ')[1];
      if (!token) { client.disconnect(); return; }

      const payload = this.jwtService.verify(token); // <-- uses module default secret
      const userId = payload.sub || payload.id;
      await client.join(`user_${userId}`);
    } catch (error) {
      this.logger.error(`Connection error: ${error.message}`);
      client.disconnect();
    }
  }
}

// ---- FIXED (notifications.gateway.ts) ----
import { ConfigService } from '@nestjs/config';

@WebSocketGateway({ cors: { origin: '*' } })
export class NotificationsGateway implements OnGatewayConnection, OnGatewayDisconnect {
  constructor(
    private readonly jwtService: JwtService,
    private readonly configService: ConfigService,
    private readonly logger: LoggingService,
  ) {}

  async handleConnection(client: Socket) {
    try {
      const token = client.handshake.auth?.token
        ?? client.handshake.headers?.authorization?.split(' ')[1];
      if (!token) { client.disconnect(); return; }

      const secret = this.configService.get<string>('JWT_ACCESS_SECRET');
      const payload = this.jwtService.verify(token, { secret }); // explicit secret
      const userId = payload.sub || payload.id;
      await client.join(`user_${userId}`);
    } catch (error) {
      this.logger.error(`Connection error: ${error.message}`);
      client.disconnect();
    }
  }
}
