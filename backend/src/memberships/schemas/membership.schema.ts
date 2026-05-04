import { Prop, Schema, SchemaFactory } from '@nestjs/mongoose';
import { HydratedDocument, Schema as MongooseSchema, Types } from 'mongoose';

export type MembershipDocument = HydratedDocument<Membership>;

@Schema({ timestamps: true, collection: 'circle_memberships' })
export class Membership {
  @Prop({
    type: MongooseSchema.Types.ObjectId,
    ref: 'User',
    required: true,
    index: true,
  })
  userId: Types.ObjectId;

  @Prop({
    type: MongooseSchema.Types.ObjectId,
    ref: 'Circle',
    required: true,
    index: true,
  })
  circleId: Types.ObjectId;
}

export const MembershipSchema = SchemaFactory.createForClass(Membership);

// Prevents duplicate memberships and covers prefix-on-userId queries
// ("what circles is user X in?") and exact compound lookups.
MembershipSchema.index({ userId: 1, circleId: 1 }, { unique: true });

// Reverse direction: "list members of circle Y, newest first." Index-covered sort.
MembershipSchema.index({ circleId: 1, createdAt: -1 });
