import { Prop, Schema, SchemaFactory } from '@nestjs/mongoose';
import { HydratedDocument, Query } from 'mongoose';

export type ThemeDocument = HydratedDocument<Theme>;

@Schema({ _id: false })
export class ThemeLabels {
  @Prop({ required: true, trim: true })
  en: string;

  @Prop({ required: true, trim: true })
  es: string;
}
const ThemeLabelsSchema = SchemaFactory.createForClass(ThemeLabels);

@Schema({ timestamps: true })
export class Theme {
  @Prop({ required: true, unique: true, lowercase: true, trim: true })
  slug: string;

  @Prop({ type: ThemeLabelsSchema, required: true })
  labels: ThemeLabels;

  @Prop({ required: true, default: 0 })
  sortOrder: number;
}

export const ThemeSchema = SchemaFactory.createForClass(Theme);

// When a theme is updated, cascade its labels onto every circle that
// references it. We always cascade (not just when labels changed) because
// the cost is one $set per affected theme — a single updateMany regardless
// of how many circles share the theme.
ThemeSchema.post(
  'findOneAndUpdate',
  async function (
    this: Query<ThemeDocument | null, ThemeDocument>,
    res: ThemeDocument | null,
  ) {
    if (!res) return;
    const Circle = this.model.db.model('Circle');
    await Circle.updateMany(
      { themeId: res._id },
      { $set: { themeLabels: { en: res.labels.en, es: res.labels.es } } },
    );
  },
);
