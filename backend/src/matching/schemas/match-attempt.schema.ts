import { Prop, Schema, SchemaFactory } from '@nestjs/mongoose';
import {
  HydratedDocument,
  Schema as MongooseSchema,
  Types,
} from 'mongoose';

export const MATCH_INTENTS = ['talk', 'specific', 'heard'] as const;

export type MatchAttemptDocument = HydratedDocument<MatchAttempt>;

@Schema({ timestamps: true, collection: 'match_attempts' })
export class MatchAttempt {
  @Prop({
    type: MongooseSchema.Types.ObjectId,
    ref: 'User',
    required: true,
    index: true,
  })
  userId!: Types.ObjectId;

  @Prop({ type: String, enum: MATCH_INTENTS, required: true })
  intent!: string;

  @Prop({
    type: [{ type: MongooseSchema.Types.ObjectId, ref: 'Circle' }],
    default: [],
  })
  circleIds!: Types.ObjectId[];

  @Prop({
    type: MongooseSchema.Types.ObjectId,
    ref: 'User',
    default: null,
  })
  matchedUserId!: Types.ObjectId | null;
}

export const MatchAttemptSchema = SchemaFactory.createForClass(MatchAttempt);

MatchAttemptSchema.index({ userId: 1, createdAt: -1 });
