import type {
  AdminUser,
  AvailableNowUser,
  Fluency,
  Role,
  User,
  UserLanguage,
} from '@base-dashboard/shared';
import type { UserDocument } from './schemas/user.schema';
import { toCircle } from '../circles/circle.mapper';
import type { AdminUserAggRow, AvailableNowUserRow } from './users.service';

export function toUser(doc: UserDocument): User {
  return {
    id: doc.id,
    email: doc.email,
    name: doc.name,
    // eslint-disable-next-line no-restricted-syntax
    role: doc.role as Role,
    timezone: doc.timezone,
    city: doc.city ?? "",
    languages: (doc.languages ?? []).map((l) => ({
      code: l.code,
      // eslint-disable-next-line no-restricted-syntax
      fluency: l.fluency as Fluency,
    })) satisfies UserLanguage[],
    // eslint-disable-next-line no-restricted-syntax
    locale: (doc.locale ?? 'en') as User['locale'],
    applicationText: doc.applicationText,
    createdAt: doc.createdAt.toISOString(),
    hostExpPoints: doc.hostExp ?? 0,
  };
}

export function toAvailableNowUser(row: AvailableNowUserRow): AvailableNowUser {
  const { user, circles } = row;
  return {
    id: user.id,
    name: user.name,
    email: user.email,
    // eslint-disable-next-line no-restricted-syntax
    role: user.role as Role,
    timezone: user.timezone,
    circles: circles.map(toCircle),
  };
}

export function toUserFromAgg(row: AdminUserAggRow): AdminUser {
  return {
    id: row._id.toString(),
    email: row.email,
    name: row.name,
    // eslint-disable-next-line no-restricted-syntax
    role: row.role as Role,
    timezone: row.timezone,
    city: row.city ?? "",
    languages: (row.languages ?? []).map((l) => ({
      code: l.code,
      // eslint-disable-next-line no-restricted-syntax
      fluency: l.fluency as Fluency,
    })) satisfies UserLanguage[],
    // eslint-disable-next-line no-restricted-syntax
    locale: (row.locale ?? 'en') as AdminUser['locale'],
    applicationText: row.applicationText,
    createdAt: row.createdAt.toISOString(),
    hostExpPoints: row.hostExp ?? 0,
    conversationCount: row.conversationCount,
  };
}
