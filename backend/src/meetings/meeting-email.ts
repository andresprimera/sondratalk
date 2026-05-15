import type { LocaleKey } from '@base-dashboard/shared';

export interface EmailCopy {
  subject(otherFirst: string, dateLabel: string): string;
  bodyText(otherFirst: string, dateLabel: string, joinUrl: string): string;
  bodyHtml(otherFirst: string, dateLabel: string, joinUrl: string): string;
  icsSummary(otherFirst: string): string;
  icsDescription(joinUrl: string): string;
}

function htmlShell(inner: string): string {
  return (
    '<!doctype html><html><body style="font-family:system-ui,-apple-system,Segoe UI,sans-serif;color:#111;line-height:1.5;padding:16px;">' +
    inner +
    '</body></html>'
  );
}

function ctaButton(label: string, joinUrl: string): string {
  return (
    `<p style="margin:24px 0;"><a href="${joinUrl}" ` +
    'style="display:inline-block;padding:10px 18px;border-radius:8px;background:#111;color:#fff;text-decoration:none;font-weight:600;">' +
    `${label}</a></p>` +
    `<p style="color:#666;font-size:12px;">${joinUrl}</p>`
  );
}

export const EMAIL_COPY: Record<LocaleKey, EmailCopy> = {
  en: {
    subject: (otherFirst, dateLabel) =>
      `Sondra: Conversation with ${otherFirst} on ${dateLabel} UTC`,
    bodyText: (otherFirst, dateLabel, joinUrl) =>
      `You have a conversation scheduled with ${otherFirst} on ${dateLabel} UTC.\n\n` +
      `Join here: ${joinUrl}\n\n` +
      `The calendar invite is attached.`,
    bodyHtml: (otherFirst, dateLabel, joinUrl) =>
      htmlShell(
        `<h2 style="margin:0 0 8px;">Sondra</h2>` +
          `<p>You have a conversation scheduled with <strong>${otherFirst}</strong> on ${dateLabel} UTC.</p>` +
          ctaButton('Join the conversation', joinUrl) +
          `<p style="color:#666;font-size:12px;">The calendar invite is attached — add it to your calendar so you don't forget.</p>`,
      ),
    icsSummary: (otherFirst) => `Sondra: Conversation with ${otherFirst}`,
    icsDescription: (joinUrl) =>
      `Join the conversation on Sondra:\n\n${joinUrl}`,
  },
  es: {
    subject: (otherFirst, dateLabel) =>
      `Sondra: Conversación con ${otherFirst} el ${dateLabel} UTC`,
    bodyText: (otherFirst, dateLabel, joinUrl) =>
      `Tienes una conversación con ${otherFirst} el ${dateLabel} UTC.\n\n` +
      `Únete aquí: ${joinUrl}\n\n` +
      `La invitación del calendario está adjunta.`,
    bodyHtml: (otherFirst, dateLabel, joinUrl) =>
      htmlShell(
        `<h2 style="margin:0 0 8px;">Sondra</h2>` +
          `<p>Tienes una conversación con <strong>${otherFirst}</strong> el ${dateLabel} UTC.</p>` +
          ctaButton('Unirme a la conversación', joinUrl) +
          `<p style="color:#666;font-size:12px;">La invitación del calendario está adjunta — añádela a tu calendario para no olvidarla.</p>`,
      ),
    icsSummary: (otherFirst) => `Sondra: Conversación con ${otherFirst}`,
    icsDescription: (joinUrl) =>
      `Únete a la conversación en Sondra:\n\n${joinUrl}`,
  },
};

const LOCALE_TO_INTL: Record<LocaleKey, string> = {
  en: 'en-GB',
  es: 'es-ES',
};

export function formatDateLabel(scheduledAt: Date, locale: LocaleKey): string {
  return scheduledAt.toLocaleString(LOCALE_TO_INTL[locale], {
    weekday: 'short',
    day: 'numeric',
    month: 'short',
    hour: '2-digit',
    minute: '2-digit',
    timeZone: 'UTC',
  });
}
