import { type Circle, type CircleType } from '@base-dashboard/shared';
import { CircleDocument } from './schemas/circle.schema';

export function toCircle(doc: CircleDocument): Circle {
  return {
    id: doc.id,
    slug: doc.slug,
    themeId: doc.themeId.toString(),
    // eslint-disable-next-line no-restricted-syntax
    type: doc.type as CircleType,
    labels: { en: doc.labels.en, es: doc.labels.es },
    aliases: { en: doc.aliases.en, es: doc.aliases.es },
    popularity: doc.popularity,
  };
}
