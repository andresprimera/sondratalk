import type { LocaleKey } from '@base-dashboard/shared';
import { renderHtml, type HtmlLabels, type MeetingEmailData } from './meeting-email';

export interface SchedulingEmailCopy {
  subject(otherFirst: string): string;
  bodyText(data: MeetingEmailData): string;
  bodyHtml(data: MeetingEmailData): string;
}

const PROPOSED_LABELS: Record<LocaleKey, HtmlLabels> = {
  en: {
    lang: 'en',
    headerLabel: 'New time proposed',
    greeting: 'Hello',
    headlinePrefix: 'New time proposed by ',
    intro:
      'Take a look at the time below and respond from your scheduling thread — accept it or suggest another one.',
    joinCta: 'Review & respond',
    joinNote: 'You can also respond from your Sondra dashboard.',
    localTimeSuffix: 'your local time',
    footerNote: (otherFirst) =>
      `This is waiting on your response so ${otherFirst} can lock in a time.`,
  },
  es: {
    lang: 'es',
    headerLabel: 'Nuevo horario propuesto',
    greeting: 'Hola',
    headlinePrefix: 'Nuevo horario propuesto por ',
    intro:
      'Revisa el horario de abajo y responde desde tu hilo de coordinación — acéptalo o propón otro.',
    joinCta: 'Revisar y responder',
    joinNote: 'También puedes responder desde tu panel de Sondra.',
    localTimeSuffix: 'tu hora local',
    footerNote: (otherFirst) =>
      `Esto espera tu respuesta para que ${otherFirst} pueda confirmar un horario.`,
  },
};

const DECLINED_LABELS: Record<LocaleKey, HtmlLabels> = {
  en: {
    lang: 'en',
    headerLabel: 'Time declined',
    greeting: 'Hello',
    headlinePrefix: 'Your proposed time was declined by ',
    intro: 'Pick another time that works and send a new proposal.',
    joinCta: 'Propose another time',
    joinNote: 'You can also respond from your Sondra dashboard.',
    localTimeSuffix: 'your local time',
    footerNote: (otherFirst) => `${otherFirst} is waiting on a new time from you.`,
  },
  es: {
    lang: 'es',
    headerLabel: 'Horario rechazado',
    greeting: 'Hola',
    headlinePrefix: 'Tu horario propuesto fue rechazado por ',
    intro: 'Elige otro horario que te funcione y envía una nueva propuesta.',
    joinCta: 'Proponer otro horario',
    joinNote: 'También puedes responder desde tu panel de Sondra.',
    localTimeSuffix: 'tu hora local',
    footerNote: (otherFirst) => `${otherFirst} espera un nuevo horario de tu parte.`,
  },
};

export const PROPOSED_TIME_EMAIL_COPY: Record<LocaleKey, SchedulingEmailCopy> = {
  en: {
    subject: (otherFirst) => `${otherFirst} proposed a new time`,
    bodyText: (data) =>
      `${data.otherFirst} proposed a new time for your conversation.\n\n` +
      `${data.dayLabel} · ${data.timeRange} ${data.tzLabel} (${PROPOSED_LABELS.en.localTimeSuffix})\n\n` +
      `Review and respond: ${data.joinUrl}`,
    bodyHtml: (data) => renderHtml(PROPOSED_LABELS.en, data),
  },
  es: {
    subject: (otherFirst) => `${otherFirst} propuso un nuevo horario`,
    bodyText: (data) =>
      `${data.otherFirst} propuso un nuevo horario para tu conversación.\n\n` +
      `${data.dayLabel} · ${data.timeRange} ${data.tzLabel} (${PROPOSED_LABELS.es.localTimeSuffix})\n\n` +
      `Revisa y responde: ${data.joinUrl}`,
    bodyHtml: (data) => renderHtml(PROPOSED_LABELS.es, data),
  },
};

export const PROPOSAL_DECLINED_EMAIL_COPY: Record<LocaleKey, SchedulingEmailCopy> = {
  en: {
    subject: (otherFirst) => `${otherFirst} can't make that time`,
    bodyText: (data) =>
      `${data.otherFirst} can't make the time you proposed.\n\n` +
      `${data.dayLabel} · ${data.timeRange} ${data.tzLabel} (${DECLINED_LABELS.en.localTimeSuffix})\n\n` +
      `Propose another time: ${data.joinUrl}`,
    bodyHtml: (data) => renderHtml(DECLINED_LABELS.en, data),
  },
  es: {
    subject: (otherFirst) => `${otherFirst} no puede asistir a esa hora`,
    bodyText: (data) =>
      `${data.otherFirst} no puede asistir a la hora que propusiste.\n\n` +
      `${data.dayLabel} · ${data.timeRange} ${data.tzLabel} (${DECLINED_LABELS.es.localTimeSuffix})\n\n` +
      `Propón otro horario: ${data.joinUrl}`,
    bodyHtml: (data) => renderHtml(DECLINED_LABELS.es, data),
  },
};
