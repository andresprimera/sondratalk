import { Logger } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { JwtService } from '@nestjs/jwt';
import {
  WebSocketGateway,
  WebSocketServer,
  type OnGatewayConnection,
} from '@nestjs/websockets';
import { Server, Socket } from 'socket.io';
import {
  CALL_SOCKET_EVENTS,
  type CallDeclinedPayload,
  type IncomingCallPayload,
} from '@base-dashboard/shared';

// Only the field we need off the verified access token. The full payload also
// carries email/role/jti (see jwt.strategy.ts), but the gateway only needs the
// subject to route socket events to a per-user room.
interface AccessTokenPayload {
  sub: string;
}

// Pull the bearer token from the socket.io handshake `auth` payload without
// leaning on `any` — `handshake.auth` is an untyped bag, so narrow from unknown.
function extractHandshakeToken(auth: unknown): string | null {
  if (typeof auth === 'object' && auth !== null && 'token' in auth) {
    const { token } = auth;
    if (typeof token === 'string' && token.length > 0) return token;
  }
  return null;
}

// Single socket.io gateway for the real-time call ring. The global HTTP
// JwtAuthGuard does not cover gateways (it uses switchToHttp), so we verify the
// JWT ourselves on connect and join each socket to a room named by userId.
// CORS is configured at bootstrap via CorsIoAdapter (main.ts), not here — the
// decorator evaluates before ConfigModule loads .env.
@WebSocketGateway()
export class RealtimeGateway implements OnGatewayConnection {
  private readonly logger = new Logger(RealtimeGateway.name);

  @WebSocketServer()
  server!: Server;

  constructor(
    private readonly jwtService: JwtService,
    private readonly configService: ConfigService,
  ) {}

  async handleConnection(client: Socket): Promise<void> {
    const token = extractHandshakeToken(client.handshake.auth);
    if (!token) {
      client.disconnect(true);
      return;
    }
    try {
      const payload = await this.jwtService.verifyAsync<AccessTokenPayload>(
        token,
        { secret: this.configService.getOrThrow<string>('JWT_ACCESS_SECRET') },
      );
      client.data.userId = payload.sub;
      await client.join(payload.sub);
    } catch {
      // Expired/invalid token — drop the socket. The client refreshes and
      // reconnects (see use-call-socket.tsx). Don't log per failed connect.
      client.disconnect(true);
    }
  }

  // Ring the callee on every device/tab they have open (socket.io fans the
  // emit out to all sockets in the user-room).
  emitIncomingCall(calleeId: string, payload: IncomingCallPayload): void {
    this.server.to(calleeId).emit(CALL_SOCKET_EVENTS.incomingCall, payload);
    this.logger.log(`Emitted incoming-call to user=${calleeId}`);
  }

  emitCallDeclined(callerId: string, payload: CallDeclinedPayload): void {
    this.server.to(callerId).emit(CALL_SOCKET_EVENTS.callDeclined, payload);
    this.logger.log(`Emitted call-declined to user=${callerId}`);
  }
}
