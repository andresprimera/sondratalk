import type {
  Fluency,
  Role,
  User,
  UserLanguage,
} from '@base-dashboard/shared';
import type { UserDocument } from './schemas/user.schema';

export function toUser(doc: UserDocument): User {
  return {
    id: doc.id,
    email: doc.email,
    name: doc.name,
    // eslint-disable-next-line no-restricted-syntax
    role: doc.role as Role,
    timezone: doc.timezone,
    languages: (doc.languages ?? []).map((l) => ({
      code: l.code,
      // eslint-disable-next-line no-restricted-syntax
      fluency: l.fluency as Fluency,
    })) satisfies UserLanguage[],
    // eslint-disable-next-line no-restricted-syntax
    locale: (doc.locale ?? 'en') as User['locale'],
    createdAt: doc.createdAt.toISOString(),
  };
}
