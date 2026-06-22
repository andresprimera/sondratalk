import { Module } from '@nestjs/common';
import { MongooseModule } from '@nestjs/mongoose';
import {
  MatchExclusion,
  MatchExclusionSchema,
} from './schemas/match-exclusion.schema';
import { MatchExclusionsService } from './match-exclusions.service';

@Module({
  imports: [
    MongooseModule.forFeature([
      { name: MatchExclusion.name, schema: MatchExclusionSchema },
    ]),
  ],
  providers: [MatchExclusionsService],
  exports: [MatchExclusionsService],
})
export class MatchExclusionsModule {}
