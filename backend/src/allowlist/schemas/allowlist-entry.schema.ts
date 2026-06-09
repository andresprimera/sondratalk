import { Prop, Schema, SchemaFactory } from '@nestjs/mongoose';
import { HydratedDocument } from 'mongoose';

export type AllowlistEntryDocument = HydratedDocument<AllowlistEntry>;

@Schema({ timestamps: true })
export class AllowlistEntry {
  // Either a full email address or a domain prefixed with "@".
  @Prop({ required: true, unique: true, lowercase: true, trim: true })
  value: string;

  @Prop({ trim: true })
  note?: string;

  // Populated automatically by `{ timestamps: true }`.
  createdAt!: Date;
}

export const AllowlistEntrySchema = SchemaFactory.createForClass(AllowlistEntry);
