import type { INestApplicationContext } from '@nestjs/common';
import { IoAdapter } from '@nestjs/platform-socket.io';
import type { ServerOptions } from 'socket.io';

// socket.io's CORS must be set on the underlying Server. We configure it at
// bootstrap (where ConfigModule has already populated process.env) rather than
// in the @WebSocketGateway decorator (which evaluates at import time, before
// .env is loaded). This keeps WS CORS identical to the HTTP CORS in main.ts.
export class CorsIoAdapter extends IoAdapter {
  private readonly corsOrigin: string[] | boolean;

  constructor(app: INestApplicationContext, corsOrigin: string[] | boolean) {
    super(app);
    this.corsOrigin = corsOrigin;
  }

  createIOServer(port: number, options?: ServerOptions) {
    return super.createIOServer(port, {
      ...options,
      cors: { origin: this.corsOrigin },
    });
  }
}
