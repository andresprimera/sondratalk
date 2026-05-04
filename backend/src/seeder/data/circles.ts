import { type CreateCircleInput } from '@base-dashboard/shared';

/**
 * Idempotent circle seeds. Each `id` is a fixed 24-char ObjectId hex string;
 * SeederService upserts by id on every boot, so editing labels/aliases
 * takes effect on next start. Editing the id reseeds as a new row.
 *
 * `themeId` references a fixed id from `themes.ts` — keep them in sync.
 *
 * Convention: ids start with `bbbb....` to distinguish from themes.
 */
export interface CircleSeed extends CreateCircleInput {
  id: string;
}

// Theme id constants (mirror seeder/data/themes.ts) — keeps the FKs readable.
const THEME_DOGS = 'aaaaaaaaaaaaaaaaaaaa0001';
const THEME_CARS = 'aaaaaaaaaaaaaaaaaaaa0002';
const THEME_MUSIC = 'aaaaaaaaaaaaaaaaaaaa0003';
const THEME_COOKING = 'aaaaaaaaaaaaaaaaaaaa0004';
const THEME_SPORTS = 'aaaaaaaaaaaaaaaaaaaa0005';

export const SEED_CIRCLES: CircleSeed[] = [
  // Dogs
  {
    id: 'bbbbbbbbbbbbbbbbbbbb0001',
    slug: 'german-shepherd',
    themeId: THEME_DOGS,
    labels: { en: 'German Shepherd', es: 'Pastor Alemán' },
    aliases: { en: ['GSD', 'Alsatian'], es: [] },
    popularity: 10,
  },
  {
    id: 'bbbbbbbbbbbbbbbbbbbb0002',
    slug: 'golden-retriever',
    themeId: THEME_DOGS,
    labels: { en: 'Golden Retriever', es: 'Golden Retriever' },
    aliases: { en: ['Goldie'], es: [] },
    popularity: 8,
  },
  {
    id: 'bbbbbbbbbbbbbbbbbbbb0003',
    slug: 'dog-walking',
    themeId: THEME_DOGS,
    labels: { en: 'Dog Walking', es: 'Paseo de perros' },
    aliases: { en: [], es: ['Pasear perros'] },
    popularity: 5,
  },

  // Cars
  {
    id: 'bbbbbbbbbbbbbbbbbbbb0010',
    slug: 'classic-cars',
    themeId: THEME_CARS,
    labels: { en: 'Classic Cars', es: 'Autos clásicos' },
    aliases: { en: ['Vintage Cars', 'Oldtimers'], es: ['Coches clásicos'] },
    popularity: 7,
  },
  {
    id: 'bbbbbbbbbbbbbbbbbbbb0011',
    slug: 'electric-vehicles',
    themeId: THEME_CARS,
    labels: { en: 'Electric Vehicles', es: 'Vehículos eléctricos' },
    aliases: { en: ['EVs'], es: ['Autos eléctricos'] },
    popularity: 9,
  },

  // Music
  {
    id: 'bbbbbbbbbbbbbbbbbbbb0020',
    slug: 'jazz',
    themeId: THEME_MUSIC,
    labels: { en: 'Jazz', es: 'Jazz' },
    aliases: { en: [], es: [] },
    popularity: 6,
  },
  {
    id: 'bbbbbbbbbbbbbbbbbbbb0021',
    slug: 'flamenco',
    themeId: THEME_MUSIC,
    labels: { en: 'Flamenco', es: 'Flamenco' },
    aliases: { en: [], es: ['Cante flamenco'] },
    popularity: 4,
  },

  // Cooking
  {
    id: 'bbbbbbbbbbbbbbbbbbbb0030',
    slug: 'spanish-cuisine',
    themeId: THEME_COOKING,
    labels: { en: 'Spanish Cuisine', es: 'Cocina española' },
    aliases: { en: ['Tapas'], es: ['Comida española', 'Gastronomía española'] },
    popularity: 7,
  },
  {
    id: 'bbbbbbbbbbbbbbbbbbbb0031',
    slug: 'baking',
    themeId: THEME_COOKING,
    labels: { en: 'Baking', es: 'Repostería' },
    aliases: { en: ['Pastry'], es: ['Pastelería'] },
    popularity: 6,
  },

  // Sports
  {
    id: 'bbbbbbbbbbbbbbbbbbbb0040',
    slug: 'football',
    themeId: THEME_SPORTS,
    labels: { en: 'Football', es: 'Fútbol' },
    aliases: { en: ['Soccer'], es: ['Balompié'] },
    popularity: 10,
  },
  {
    id: 'bbbbbbbbbbbbbbbbbbbb0041',
    slug: 'tennis',
    themeId: THEME_SPORTS,
    labels: { en: 'Tennis', es: 'Tenis' },
    aliases: { en: [], es: [] },
    popularity: 6,
  },
];
