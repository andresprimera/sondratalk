import { Module } from '@nestjs/common';
import { MongooseModule } from '@nestjs/mongoose';
import {
  AllowlistEntry,
  AllowlistEntrySchema,
} from './schemas/allowlist-entry.schema';
import { AllowlistService } from './allowlist.service';
import { AllowlistController } from './allowlist.controller';

@Module({
  imports: [
    MongooseModule.forFeature([
      { name: AllowlistEntry.name, schema: AllowlistEntrySchema },
    ]),
  ],
  controllers: [AllowlistController],
  providers: [AllowlistService],
  exports: [AllowlistService],
})
export class AllowlistModule {}
