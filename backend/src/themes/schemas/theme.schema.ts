import { Prop, Schema, SchemaFactory } from '@nestjs/mongoose';
import { HydratedDocument } from 'mongoose';

export type ThemeDocument = HydratedDocument<Theme>;

@Schema({ timestamps: true })
export class Theme {
  @Prop({ required: true, unique: true, lowercase: true, trim: true })
  slug: string;

  @Prop({ required: true, trim: true })
  label: string;

  @Prop({ required: true, default: 0 })
  sortOrder: number;
}

export const ThemeSchema = SchemaFactory.createForClass(Theme);
