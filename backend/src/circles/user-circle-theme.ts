// Synthetic "Other" theme used for user-created (custom) circles added during
// onboarding. It is intentionally NOT seeded as a Theme document: a Circle only
// needs a `themeId` plus the denormalized `themeLabels` snapshot to work in
// browse, search, and the admin table (nothing resolves a Circle's themeId back
// to a live Theme — see circle.mapper.ts). Keeping the identity here makes
// custom-circle creation self-contained and independent of whether the seeder
// ran, so it works the same in dev and prod.
export const USER_CIRCLE_THEME_ID = 'dddddddddddddddddddd000b';

export const USER_CIRCLE_THEME_LABELS: { en: string; es: string } = {
  en: 'Other',
  es: 'Otros',
};
