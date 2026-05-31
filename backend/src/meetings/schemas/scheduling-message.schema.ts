import { Prop, Schema, SchemaFactory } from '@nestjs/mongoose';
import {
  HydratedDocument,
  Schema as MongooseSchema,
  Types,
} from 'mongoose';

export type SchedulingMessageDocument = HydratedDocument<SchedulingMessage>;

@Schema({ timestamps: true })
export class SchedulingMessage {
  @Prop({
    type: MongooseSchema.Types.ObjectId,
    ref: 'Meeting',
    required: true,
  })
  meetingId!: Types.ObjectId;

  @Prop({
    type: MongooseSchema.Types.ObjectId,
    ref: 'User',
    required: true,
  })
  senderId!: Types.ObjectId;

  @Prop({
    required: true,
    enum: ['time_proposal', 'proposal_response'],
  })
  kind!: string;

  // Set on `time_proposal` messages.
  @Prop()
  proposedAt?: Date;

  // Set on `proposal_response` messages.
  @Prop({ type: MongooseSchema.Types.ObjectId, ref: 'SchedulingMessage' })
  replyToId?: Types.ObjectId;

  @Prop()
  accept?: boolean;

  createdAt!: Date;
  updatedAt!: Date;
}

export const SchedulingMessageSchema =
  SchemaFactory.createForClass(SchedulingMessage);

SchedulingMessageSchema.index({ meetingId: 1, createdAt: 1 });
