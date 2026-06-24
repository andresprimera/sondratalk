import { Prop, Schema, SchemaFactory } from '@nestjs/mongoose';
import { HydratedDocument, Schema as MongooseSchema, Types } from 'mongoose';

export type MatchExclusionDocument = HydratedDocument<MatchExclusion>;

// One-directional: fromUserId never wants toUserId surfaced as a match again.
// Standalone from ConversationFeedback so it isn't tied to a single meeting's
// door-open state and survives independently of it.
@Schema({ timestamps: true, collection: 'match_exclusions' })
export class MatchExclusion {
  @Prop({
    type: MongooseSchema.Types.ObjectId,
    ref: 'User',
    required: true,
  })
  fromUserId!: Types.ObjectId;

  @Prop({
    type: MongooseSchema.Types.ObjectId,
    ref: 'User',
    required: true,
  })
  toUserId!: Types.ObjectId;

  createdAt!: Date;
  updatedAt!: Date;
}

export const MatchExclusionSchema =
  SchemaFactory.createForClass(MatchExclusion);

MatchExclusionSchema.index({ fromUserId: 1, toUserId: 1 }, { unique: true });
