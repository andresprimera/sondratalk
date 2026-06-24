import { Module } from '@nestjs/common';
import { MongooseModule } from '@nestjs/mongoose';
import {
  MatchAttempt,
  MatchAttemptSchema,
} from './schemas/match-attempt.schema';
import { MatchingService } from './matching.service';
import { MatchingController } from './matching.controller';
import { MembershipsModule } from '../memberships/memberships.module';
import { AvailabilityModule } from '../availability/availability.module';
import { UsersModule } from '../users/users.module';
import { CirclesModule } from '../circles/circles.module';
import { MeetingsModule } from '../meetings/meetings.module';
import { MatchExclusionsModule } from '../match-exclusions/match-exclusions.module';

@Module({
  imports: [
    MongooseModule.forFeature([
      { name: MatchAttempt.name, schema: MatchAttemptSchema },
    ]),
    MembershipsModule,
    AvailabilityModule,
    UsersModule,
    CirclesModule,
    MeetingsModule,
    MatchExclusionsModule,
  ],
  controllers: [MatchingController],
  providers: [MatchingService],
})
export class MatchingModule {}
