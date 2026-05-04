import { type CreateThemeInput } from '@base-dashboard/shared';

/**
 * Idempotent theme seeds. Each `id` is a fixed 24-char ObjectId hex string;
 * SeederService upserts by id on every boot, so editing a row's data
 * (labels, sortOrder) takes effect on next start. Editing the id reseeds
 * as a new row — don't unless you mean it.
 *
 * Convention: ids start with `aaaa....` and the last hex pair encodes the
 * sequence so they're easy to scan visually.
 */
export interface ThemeSeed extends CreateThemeInput {
  id: string;
}

export const SEED_THEMES: ThemeSeed[] = [
  {
    id: 'aaaaaaaaaaaaaaaaaaaa0001',
    slug: 'dogs',
    labels: { en: 'Dogs', es: 'Perros' },
    sortOrder: 1,
  },
  {
    id: 'aaaaaaaaaaaaaaaaaaaa0002',
    slug: 'cars',
    labels: { en: 'Cars', es: 'Autos' },
    sortOrder: 2,
  },
  {
    id: 'aaaaaaaaaaaaaaaaaaaa0003',
    slug: 'music',
    labels: { en: 'Music', es: 'Música' },
    sortOrder: 3,
  },
  {
    id: 'aaaaaaaaaaaaaaaaaaaa0004',
    slug: 'cooking',
    labels: { en: 'Cooking', es: 'Cocina' },
    sortOrder: 4,
  },
  {
    id: 'aaaaaaaaaaaaaaaaaaaa0005',
    slug: 'sports',
    labels: { en: 'Sports', es: 'Deportes' },
    sortOrder: 5,
  },
];
