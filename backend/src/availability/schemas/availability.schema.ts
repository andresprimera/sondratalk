import { Prop, Schema, SchemaFactory } from '@nestjs/mongoose';
import {
  HydratedDocument,
  Schema as MongooseSchema,
  Types,
} from 'mongoose';

// Must stay aligned with periodEnum / dayEnum in @base-dashboard/shared.
// availability.service.spec.ts asserts equality so drift fails CI.
export const PERIODS = ['morning', 'afternoon', 'evening'] as const;
export const DAYS = [
  'mon',
  'tue',
  'wed',
  'thu',
  'fri',
  'sat',
  'sun',
] as const;

@Schema({ _id: false })
export class AvailabilityWindow {
  @Prop({ type: String, enum: PERIODS, required: true })
  period!: string;

  @Prop({ type: String, enum: DAYS, required: true })
  day!: string;
}

const AvailabilityWindowSchema =
  SchemaFactory.createForClass(AvailabilityWindow);

export type AvailabilityDocument = HydratedDocument<Availability>;

@Schema({ timestamps: true, collection: 'user_availability' })
export class Availability {
  @Prop({
    type: MongooseSchema.Types.ObjectId,
    ref: 'User',
    required: true,
    unique: true,
    index: true,
  })
  userId!: Types.ObjectId;

  @Prop({ type: [AvailabilityWindowSchema], default: [] })
  windows!: AvailabilityWindow[];

  @Prop({ type: Boolean, default: false })
  isAvailableNow!: boolean;
}

export const AvailabilitySchema = SchemaFactory.createForClass(Availability);
