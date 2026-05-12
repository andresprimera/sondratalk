import { Module } from '@nestjs/common';
import { CallsController } from './calls.controller';
import { CallsService } from './calls.service';
import { LivekitModule } from '../services/livekit/livekit.module';
import { UsersModule } from '../users/users.module';

@Module({
  imports: [LivekitModule, UsersModule],
  controllers: [CallsController],
  providers: [CallsService],
})
export class CallsModule {}
