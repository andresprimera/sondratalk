import { Prop, Schema, SchemaFactory } from '@nestjs/mongoose';
import {
  HydratedDocument,
  Schema as MongooseSchema,
  Types,
} from 'mongoose';

export type MeetingDocument = HydratedDocument<Meeting>;

@Schema({ timestamps: true })
export class Meeting {
  @Prop({
    type: [{ type: MongooseSchema.Types.ObjectId, ref: 'User' }],
    required: true,
  })
  participants!: Types.ObjectId[];

  @Prop({
    type: MongooseSchema.Types.ObjectId,
    ref: 'User',
    required: true,
  })
  initiatorId!: Types.ObjectId;

  @Prop({ required: true })
  scheduledAt!: Date;

  @Prop({ required: true })
  expiresAt!: Date;

  @Prop({ default: false })
  cancelled!: boolean;

  @Prop({ default: false })
  instant!: boolean;

  // Set when the callee declines an instant call's ring, so the caller can be
  // told "they declined" instead of waiting out the join timeout.
  @Prop({ type: Date, default: null })
  declinedAt!: Date | null;

  createdAt!: Date;
  updatedAt!: Date;
}

export const MeetingSchema = SchemaFactory.createForClass(Meeting);

MeetingSchema.index({
  participants: 1,
  cancelled: 1,
  expiresAt: 1,
  scheduledAt: 1,
});
