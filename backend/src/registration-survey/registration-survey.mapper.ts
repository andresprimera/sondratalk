import type {
  AgeRange,
  DistanceFromHome,
  RegistrationIntent,
  RegistrationSurvey as RegistrationSurveyDto,
  RealConversations,
} from '@base-dashboard/shared';
import type { RegistrationSurveyDocument } from './schemas/registration-survey.schema';

export function toRegistrationSurvey(
  doc: RegistrationSurveyDocument,
): RegistrationSurveyDto {
  return {
    id: doc.id,
    userId: doc.userId.toString(),
    // eslint-disable-next-line no-restricted-syntax
    intent: doc.intent as RegistrationIntent,
    // eslint-disable-next-line no-restricted-syntax
    ageRange: doc.ageRange as AgeRange,
    // eslint-disable-next-line no-restricted-syntax
    realConversations: doc.realConversations as RealConversations,
    daysSpent: doc.daysSpent,
    // eslint-disable-next-line no-restricted-syntax
    distanceFromHome: doc.distanceFromHome as DistanceFromHome,
    circles: doc.circles,
    blocker: doc.blocker,
    createdAt: doc.createdAt.toISOString(),
    updatedAt: doc.updatedAt.toISOString(),
  };
}
