import { Prop, Schema, SchemaFactory } from '@nestjs/mongoose';
import { HydratedDocument, Query } from 'mongoose';

export type UserDocument = HydratedDocument<User>;

@Schema({ timestamps: true })
export class User {
  @Prop({ required: true })
  name: string;

  @Prop({ required: true, unique: true, lowercase: true, trim: true })
  email: string;

  @Prop({ required: true, enum: ['admin', 'user'], default: 'user' })
  role!: string;

  @Prop({ required: true, select: false })
  password: string;

  @Prop({ select: false })
  hashedRefreshToken?: string;

  @Prop({ select: false })
  hashedPasswordResetToken?: string;

  @Prop({ select: false })
  passwordResetExpires?: Date;
}

export const UserSchema = SchemaFactory.createForClass(User);

// Cascade delete: when a user is removed (admin deletes them), wipe their
// memberships from the `circle_memberships` collection. Mirror the same
// pattern in circle.schema.ts.
UserSchema.post(
  'findOneAndDelete',
  async function (
    this: Query<UserDocument | null, UserDocument>,
    res: UserDocument | null,
  ) {
    if (!res) return;
    await this.model.db
      .model('Membership')
      .deleteMany({ userId: res._id });
  },
);
