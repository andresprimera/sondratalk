import { Module } from '@nestjs/common';
import { MongooseModule } from '@nestjs/mongoose';
import { Meeting, MeetingSchema } from './schemas/meeting.schema';
import {
  SchedulingMessage,
  SchedulingMessageSchema,
} from './schemas/scheduling-message.schema';
import { MeetingsController } from './meetings.controller';
import { MeetingsService } from './meetings.service';
import { SchedulingController } from './scheduling.controller';
import { SchedulingService } from './scheduling.service';
import { UsersModule } from '../users/users.module';
import { MailModule } from '../services/mail/mail.module';
import { AvailabilityModule } from '../availability/availability.module';
import { RealtimeModule } from '../realtime/realtime.module';

@Module({
  imports: [
    MongooseModule.forFeature([
      { name: Meeting.name, schema: MeetingSchema },
      { name: SchedulingMessage.name, schema: SchedulingMessageSchema },
    ]),
    UsersModule,
    MailModule,
    AvailabilityModule,
    RealtimeModule,
  ],
  controllers: [MeetingsController, SchedulingController],
  providers: [MeetingsService, SchedulingService],
  exports: [MeetingsService],
})
export class MeetingsModule {}
