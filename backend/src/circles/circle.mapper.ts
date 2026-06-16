import { type AdminCircle, type Circle, type CircleType } from '@base-dashboard/shared';
import { CircleDocument } from './schemas/circle.schema';
import type { AdminCircleAggRow } from './circles.service';

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

export function toCircleFromAgg(row: AdminCircleAggRow): AdminCircle {
  return {
    id: row._id.toString(),
    slug: row.slug,
    themeId: row.themeId.toString(),
    // eslint-disable-next-line no-restricted-syntax
    type: row.type as CircleType,
    labels: { en: row.labels.en, es: row.labels.es },
    aliases: { en: row.aliases.en, es: row.aliases.es },
    popularity: row.popularity,
    membershipCount: row.membershipCount,
  };
}
