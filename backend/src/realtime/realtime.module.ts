import { Module } from '@nestjs/common';
import { JwtModule } from '@nestjs/jwt';
import { RealtimeGateway } from './realtime.gateway';

// Self-contained realtime module. The gateway verifies JWTs with an explicit
// secret per call, so JwtModule needs no static config (mirrors AuthModule).
@Module({
  imports: [JwtModule.register({})],
  providers: [RealtimeGateway],
  exports: [RealtimeGateway],
})
export class RealtimeModule {}
