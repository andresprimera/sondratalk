import { Prop, Schema, SchemaFactory } from '@nestjs/mongoose';
import { HydratedDocument, Schema as MongooseSchema, Types } from 'mongoose';

export type RegistrationSurveyDocument = HydratedDocument<RegistrationSurvey>;

@Schema({ timestamps: true, collection: 'registration_surveys' })
export class RegistrationSurvey {
  @Prop({
    type: MongooseSchema.Types.ObjectId,
    ref: 'User',
    required: true,
  })
  userId!: Types.ObjectId;

  @Prop({
    required: true,
    enum: ['curiosity', 'deeper', 'new-city', 'other-lives', 'personal'],
  })
  intent!: string;

  @Prop({
    required: true,
    enum: ['18-24', '25-34', '35-44', '45-54', '55-64', '65+'],
  })
  ageRange!: string;

  @Prop({ required: true, enum: ['yes', 'no'] })
  realConversations!: string;

  @Prop({ required: true })
  daysSpent!: string;

  @Prop({
    required: true,
    enum: ['still-there', 'another-country', 'lost-count'],
  })
  distanceFromHome!: string;

  @Prop({ type: [String], default: [] })
  circles!: string[];

  @Prop({ required: true })
  blocker!: string;

  createdAt!: Date;
  updatedAt!: Date;
}

export const RegistrationSurveySchema =
  SchemaFactory.createForClass(RegistrationSurvey);

// One survey document per user — a re-submission upserts into the same row.
RegistrationSurveySchema.index({ userId: 1 }, { unique: true });
