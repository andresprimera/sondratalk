import { Prop, Schema, SchemaFactory } from '@nestjs/mongoose';
import { HydratedDocument, Query } from 'mongoose';

export type UserDocument = HydratedDocument<User>;

@Schema({ _id: false })
export class UserLanguage {
  @Prop({ required: true })
  code!: string;

  @Prop({ required: true, enum: ['Conversational', 'Fluent', 'Native'] })
  fluency!: string;
}
const UserLanguageSchema = SchemaFactory.createForClass(UserLanguage);

@Schema({ _id: false })
export class UserSession {
  @Prop({ required: true })
  jti!: string;

  @Prop({ required: true })
  hashedToken!: string;

  @Prop({ required: true })
  createdAt!: Date;

  @Prop({ required: true })
  lastUsedAt!: Date;
}
const UserSessionSchema = SchemaFactory.createForClass(UserSession);

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

  @Prop({ type: [UserSessionSchema], default: [], select: false })
  sessions!: UserSession[];

  @Prop({ select: false })
  hashedPasswordResetToken?: string;

  @Prop({ select: false })
  passwordResetExpires?: Date;

  // Number of past conversations where this user showed up as a listener
  // or adviser. Populated later by the post-call role tag; until then it's
  // 0 unless seeded/admin-edited. Read by the `heard` matching intent.
  @Prop({ type: Number, default: 0, min: 0 })
  hostExp!: number;

  @Prop({ required: true, default: 'UTC' })
  timezone!: string;

  @Prop({ default: '' })
  city!: string;

  @Prop({ type: [UserLanguageSchema], default: [] })
  languages!: UserLanguage[];

  @Prop({ required: true, enum: ['en', 'es'], default: 'en' })
  locale!: string;

  @Prop()
  applicationText?: string;

  // Populated automatically by `{ timestamps: true }`.
  createdAt!: Date;
  updatedAt!: Date;
}

export const UserSchema = SchemaFactory.createForClass(User);

// Cascade delete: when a user is removed (admin deletes them), wipe their
// memberships from the `circle_memberships` collection and their availability
// doc from `user_availability`. Mirror the same pattern in circle.schema.ts.
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
    await this.model.db
      .model('Availability')
      .deleteOne({ userId: res._id });
  },
);
