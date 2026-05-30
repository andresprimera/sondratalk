import { Module } from '@nestjs/common';
import { MongooseModule } from '@nestjs/mongoose';
import { Meeting, MeetingSchema } from './schemas/meeting.schema';
import { MeetingsController } from './meetings.controller';
import { MeetingsService } from './meetings.service';
import { UsersModule } from '../users/users.module';
import { MailModule } from '../services/mail/mail.module';
import { AvailabilityModule } from '../availability/availability.module';

@Module({
  imports: [
    MongooseModule.forFeature([{ name: Meeting.name, schema: MeetingSchema }]),
    UsersModule,
    MailModule,
    AvailabilityModule,
  ],
  controllers: [MeetingsController],
  providers: [MeetingsService],
  exports: [MeetingsService],
})
export class MeetingsModule {}
