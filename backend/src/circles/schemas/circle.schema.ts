import { Prop, Schema, SchemaFactory } from '@nestjs/mongoose';
import {
  HydratedDocument,
  Query,
  Schema as MongooseSchema,
  Types,
} from 'mongoose';

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

// Denormalized copy of the parent Theme's labels. Kept on the Circle so
// Atlas Search can match circles by their theme's localized name (e.g.,
// typing "perros" in Spanish UI surfaces all circles in the "Perros"
// theme). Cascade-updated by a post-findOneAndUpdate hook on Theme — see
// backend/src/themes/schemas/theme.schema.ts.
@Schema({ _id: false })
export class CircleThemeLabels {
  @Prop({ required: true, trim: true })
  en: string;

  @Prop({ required: true, trim: true })
  es: string;
}
const CircleThemeLabelsSchema = SchemaFactory.createForClass(CircleThemeLabels);

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

  @Prop({ type: CircleThemeLabelsSchema, required: true })
  themeLabels: CircleThemeLabels;

  @Prop({ required: true, default: 0, min: 0 })
  popularity: number;
}

export const CircleSchema = SchemaFactory.createForClass(Circle);

CircleSchema.index({ themeId: 1, popularity: -1 });

// Cascade delete: when a circle is removed, wipe its memberships so the
// `circle_memberships` collection doesn't accumulate orphans. Mirror the
// same pattern in user.schema.ts.
CircleSchema.post(
  'findOneAndDelete',
  async function (
    this: Query<CircleDocument | null, CircleDocument>,
    res: CircleDocument | null,
  ) {
    if (!res) return;
    await this.model.db
      .model('Membership')
      .deleteMany({ circleId: res._id });
  },
);
