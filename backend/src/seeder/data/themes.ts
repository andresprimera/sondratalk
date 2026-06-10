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

// Themes are topical umbrellas that relate circles by subject — they are
// ORTHOGONAL to a circle's `type` (the onboarding category). A single theme
// can hold circles of different types: "Work & Ambition" groups Entrepreneur
// (who-you-are), Career Change and First Job (where-you-are). See the
// theme → circle assignments in ./circles.ts.
//
// Convention: ids start with `dddd....` and the last hex pair is the sequence.
export const SEED_THEMES: ThemeSeed[] = [
  {
    id: 'dddddddddddddddddddd0001',
    slug: 'heritage-migration',
    labels: { en: 'Heritage & Migration', es: 'Raíces y migración' },
    sortOrder: 1,
  },
  {
    id: 'dddddddddddddddddddd0002',
    slug: 'work-ambition',
    labels: { en: 'Work & Ambition', es: 'Trabajo y ambición' },
    sortOrder: 2,
  },
  {
    id: 'dddddddddddddddddddd0003',
    slug: 'arts-creativity',
    labels: { en: 'Arts & Creativity', es: 'Arte y creatividad' },
    sortOrder: 3,
  },
  {
    id: 'dddddddddddddddddddd0004',
    slug: 'sports-movement',
    labels: { en: 'Sports & Movement', es: 'Deporte y movimiento' },
    sortOrder: 4,
  },
  {
    id: 'dddddddddddddddddddd0005',
    slug: 'mind-spirit-play',
    labels: { en: 'Mind, Spirit & Play', es: 'Mente, espíritu y juego' },
    sortOrder: 5,
  },
  {
    id: 'dddddddddddddddddddd0006',
    slug: 'community-beliefs',
    labels: { en: 'Community & Beliefs', es: 'Comunidad y creencias' },
    sortOrder: 6,
  },
  {
    id: 'dddddddddddddddddddd0007',
    slug: 'food-travel',
    labels: { en: 'Food & Travel', es: 'Comida y viajes' },
    sortOrder: 7,
  },
  {
    id: 'dddddddddddddddddddd0008',
    slug: 'family-relationships',
    labels: { en: 'Family & Relationships', es: 'Familia y relaciones' },
    sortOrder: 8,
  },
  {
    id: 'dddddddddddddddddddd0009',
    slug: 'new-chapters',
    labels: { en: 'New Chapters', es: 'Nuevos capítulos' },
    sortOrder: 9,
  },
  {
    id: 'dddddddddddddddddddd000a',
    slug: 'health-resilience',
    labels: { en: 'Health & Resilience', es: 'Salud y resiliencia' },
    sortOrder: 10,
  },
];
