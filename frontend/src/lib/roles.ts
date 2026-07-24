// Maps a user role to its English display label. The value doubles as the
// i18n key (English-string-as-key convention), so callers wrap it in t().
export const ROLE_LABELS: Record<string, string> = {
  admin: "Admin",
  user: "User",
  founding_member: "Founding Member",
}
