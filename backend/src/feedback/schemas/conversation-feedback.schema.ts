import { Prop, Schema, SchemaFactory } from '@nestjs/mongoose';
import {
  HydratedDocument,
  Schema as MongooseSchema,
  Types,
} from 'mongoose';

export type ConversationFeedbackDocument =
  HydratedDocument<ConversationFeedback>;

@Schema({ _id: false })
export class ConversationReport {
  @Prop({
    required: true,
    enum: [
      'disrespectful',
      'inappropriate',
      'no_show',
      'solicitation',
      'unsafe',
      'other',
    ],
  })
  reason!: string;

  @Prop()
  detail?: string;
}

export const ConversationReportSchema =
  SchemaFactory.createForClass(ConversationReport);

@Schema({ timestamps: true, collection: 'conversation_feedback' })
export class ConversationFeedback {
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
  userId!: Types.ObjectId;

  @Prop({ enum: ['yes', 'maybe', 'no'] })
  talkAgain?: string;

  @Prop({ default: false })
  doorOpen!: boolean;

  @Prop()
  doorNote?: string;

  @Prop()
  feeling?: string;

  @Prop({ enum: ['yes', 'somewhat', 'not_really'] })
  circlesRelevant?: string;

  @Prop({ enum: ['yes', 'no'] })
  exchangedContact?: string;

  @Prop({ enum: ['good', 'minor_issues', 'significant_problems'] })
  avQuality?: string;

  @Prop({ min: 1, max: 5 })
  matchRating?: number;

  @Prop()
  privateNotes?: string;

  @Prop({ type: ConversationReportSchema })
  report?: ConversationReport;

  createdAt!: Date;
  updatedAt!: Date;
}

export const ConversationFeedbackSchema = SchemaFactory.createForClass(
  ConversationFeedback,
);

// One feedback document per (meeting, user) — submissions upsert into it.
ConversationFeedbackSchema.index({ meetingId: 1, userId: 1 }, { unique: true });
