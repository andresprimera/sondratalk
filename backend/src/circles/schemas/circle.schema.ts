import { Prop, Schema, SchemaFactory } from '@nestjs/mongoose';
import { HydratedDocument, Schema as MongooseSchema, Types } from 'mongoose';

// NOTE: locale fields here (en, es) must stay in sync with LOCALE_KEYS in
// shared/src/schemas/circle.ts. Adding a new locale = update both places.

export type CircleDocument = HydratedDocument<Circle>;

@Schema({ _id: false })
export class CircleLabels {
  @Prop({ required: true, trim: true })
  en: string;

  @Prop({ required: true, trim: true })
  es: string;
}
const CircleLabelsSchema = SchemaFactory.createForClass(CircleLabels);

@Schema({ _id: false })
export class CircleAliases {
  @Prop({ type: [String], default: [] })
  en: string[];

  @Prop({ type: [String], default: [] })
  es: string[];
}
const CircleAliasesSchema = SchemaFactory.createForClass(CircleAliases);

@Schema({ timestamps: true })
export class Circle {
  @Prop({ required: true, unique: true, lowercase: true, trim: true })
  slug: string;

  @Prop({
    type: MongooseSchema.Types.ObjectId,
    ref: 'Theme',
    required: true,
    index: true,
  })
  themeId: Types.ObjectId;

  @Prop({ type: CircleLabelsSchema, required: true })
  labels: CircleLabels;

  @Prop({ type: CircleAliasesSchema, default: () => ({ en: [], es: [] }) })
  aliases: CircleAliases;

  @Prop({ type: [String], default: [] })
  searchTerms: string[];

  @Prop({ required: true, default: 0, min: 0 })
  popularity: number;
}

export const CircleSchema = SchemaFactory.createForClass(Circle);

CircleSchema.index({ searchTerms: 'text' });
CircleSchema.index({ themeId: 1, popularity: -1 });
