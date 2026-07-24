// Base UI's Select requires a non-empty item value, so "no theme" is
// represented by this sentinel rather than an empty string.
export const NO_THEME_SELECT_VALUE = "__none__"

// A brand-new circle simply omits themeId when no theme is picked — there's
// no prior value to explicitly clear, unlike editing.
export function themeSelectValueForCreate(val: string): string | undefined {
  return val === NO_THEME_SELECT_VALUE ? undefined : val
}

// Editing an existing circle must be able to explicitly clear a theme it
// already had, so "no theme" maps to null (a real value to send in the
// PATCH), not undefined (which the backend reads as "leave untouched").
export function themeSelectValueForUpdate(val: string): string | null {
  return val === NO_THEME_SELECT_VALUE ? null : val
}
