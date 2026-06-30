import type { LocaleKey } from '@base-dashboard/shared';

export interface MeetingEmailData {
  otherFirst: string;
  dayLabel: string;
  timeRange: string;
  tzLabel: string;
  joinUrl: string;
}

export interface EmailCopy {
  subject(otherFirst: string): string;
  bodyText(data: MeetingEmailData): string;
  bodyHtml(data: MeetingEmailData): string;
  icsSummary(otherFirst: string): string;
  icsDescription(joinUrl: string): string;
}

// Per-locale strings used to render the confirmation email card. The HTML
// structure itself is shared (see renderHtml) so the design stays in one place.
export interface HtmlLabels {
  lang: string;
  headerLabel: string;
  greeting: string;
  headlinePrefix: string;
  intro: string;
  joinCta: string;
  joinNote: string;
  localTimeSuffix: string;
  footerNote(otherFirst: string): string;
}

function escapeHtml(value: string): string {
  return value
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;');
}

// Email-client-safe rendering: table-based layout, inline styles, no <style>
// block, no flexbox/grid, no web fonts assumed (Cormorant Garamond is offered
// first but degrades to Georgia). Mirrors email-confirmation-mockup.html.
// Exported so other meeting-related notifications (e.g. scheduling proposals)
// can reuse the same card design with their own copy.
export function renderHtml(labels: HtmlLabels, data: MeetingEmailData): string {
  const name = escapeHtml(data.otherFirst);
  const dayLabel = escapeHtml(data.dayLabel);
  const timeRange = escapeHtml(data.timeRange);
  const tzLabel = escapeHtml(data.tzLabel);
  const appOrigin = escapeHtml(new URL(data.joinUrl).origin);
  const appHost = escapeHtml(new URL(data.joinUrl).hostname);
  const serif = "'Cormorant Garamond',Georgia,'Times New Roman',serif";

  return (
    `<!doctype html><html lang="${labels.lang}"><head>` +
    '<meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1">' +
    '</head>' +
    '<body style="margin:0;padding:0;background:#e8e6e1;">' +
    '<table role="presentation" width="100%" cellpadding="0" cellspacing="0" border="0" ' +
    'style="background:#e8e6e1;"><tr><td align="center" style="padding:32px 12px;">' +
    `<table role="presentation" width="560" cellpadding="0" cellspacing="0" border="0" ` +
    `style="max-width:560px;width:100%;background:#070d18;border-radius:14px;overflow:hidden;font-family:${serif};">` +
    // top stripe
    '<tr><td style="height:3px;background:#4d8a60;font-size:0;line-height:0;">&nbsp;</td></tr>' +
    // header
    '<tr><td style="padding:28px 36px 22px;border-bottom:1px solid rgba(232,220,196,0.07);">' +
    '<table role="presentation" width="100%" cellpadding="0" cellspacing="0" border="0"><tr>' +
    '<td style="font-size:20px;font-weight:500;letter-spacing:1px;color:#e8dcc4;">Sondra</td>' +
    `<td align="right" style="font-size:11px;letter-spacing:2px;text-transform:uppercase;color:#4d8a60;">${labels.headerLabel}</td>` +
    '</tr></table></td></tr>' +
    // body
    '<tr><td style="padding:34px 36px;">' +
    `<p style="margin:0 0 22px;font-size:12px;letter-spacing:1.4px;text-transform:uppercase;color:#8a7d63;">${labels.greeting}</p>` +
    `<h1 style="margin:0 0 8px;font-size:26px;font-weight:400;color:#e8dcc4;line-height:1.35;">${labels.headlinePrefix}<strong style="font-weight:600;">${name}</strong>.</h1>` +
    // time block
    '<table role="presentation" width="100%" cellpadding="0" cellspacing="0" border="0" ' +
    'style="margin:26px 0;background:#0e1a2c;border-radius:8px;border-left:2px solid #4d8a60;">' +
    '<tr><td style="padding:18px 22px;">' +
    `<div style="font-size:12px;letter-spacing:1.4px;text-transform:uppercase;color:#8a7d63;padding-bottom:4px;">${dayLabel}</div>` +
    `<div style="font-size:23px;color:#e8dcc4;">${timeRange}</div>` +
    `<div style="font-size:12px;color:#8a7d63;font-style:italic;padding-top:3px;">${tzLabel} · ${labels.localTimeSuffix}</div>` +
    '</td></tr></table>' +
    `<p style="margin:0 0 26px;font-size:16px;color:#a89878;line-height:1.7;">${labels.intro}</p>` +
    // CTA button
    '<table role="presentation" width="100%" cellpadding="0" cellspacing="0" border="0"><tr>' +
    '<td align="center" style="border-radius:10px;background:#4d8a60;">' +
    `<a href="${data.joinUrl}" style="display:block;padding:15px 20px;font-family:${serif};font-size:17px;font-weight:600;letter-spacing:1px;color:#e8f2ec;text-decoration:none;text-align:center;">${labels.joinCta}</a>` +
    '</td></tr></table>' +
    `<p style="margin:12px 0 0;font-size:13px;font-style:italic;color:#6f6650;text-align:center;line-height:1.55;">${labels.joinNote}</p>` +
    '<hr style="border:none;border-top:1px solid rgba(232,220,196,0.08);margin:30px 0 22px;">' +
    `<p style="margin:0;font-size:12px;color:#5f5848;line-height:1.65;text-align:center;">${labels.footerNote(name)}</p>` +
    '</td></tr>' +
    // footer
    '<tr><td style="padding:20px 36px 30px;border-top:1px solid rgba(232,220,196,0.05);">' +
    '<table role="presentation" width="100%" cellpadding="0" cellspacing="0" border="0"><tr>' +
    '<td style="font-size:13px;letter-spacing:1px;color:#6f6650;">Sondra</td>' +
    `<td align="right"><a href="${appOrigin}" style="font-size:12px;color:#6f6650;text-decoration:none;letter-spacing:0.5px;">${appHost}</a></td>` +
    '</tr></table></td></tr>' +
    '</table></td></tr></table></body></html>'
  );
}

const HTML_LABELS: Record<LocaleKey, HtmlLabels> = {
  en: {
    lang: 'en',
    headerLabel: 'Conversation confirmed',
    greeting: 'Hello',
    headlinePrefix: 'You have a conversation scheduled with ',
    intro:
      "When it's time, join the conversation from the button below. We've attached a calendar invite so it lands on your schedule.",
    joinCta: 'Join Conversation',
    joinNote: 'You can also join from your Sondra dashboard.',
    localTimeSuffix: 'your local time',
    footerNote: (otherFirst) =>
      `If you can't make it, please cancel in advance so ${otherFirst} isn't left waiting. You can manage this conversation from your Sondra dashboard.`,
  },
  es: {
    lang: 'es',
    headerLabel: 'Conversación confirmada',
    greeting: 'Hola',
    headlinePrefix: 'Tienes una conversación con ',
    intro:
      'Cuando llegue el momento, únete a la conversación desde el botón de abajo. Adjuntamos una invitación de calendario para que no se te olvide.',
    joinCta: 'Unirme a la conversación',
    joinNote: 'También puedes unirte desde tu panel de Sondra.',
    localTimeSuffix: 'tu hora local',
    footerNote: (otherFirst) =>
      `Si no puedes asistir, cancela con antelación para que ${otherFirst} no se quede esperando. Puedes gestionar esta conversación desde tu panel de Sondra.`,
  },
};

export const EMAIL_COPY: Record<LocaleKey, EmailCopy> = {
  en: {
    subject: (otherFirst) => `Your conversation with ${otherFirst} is confirmed`,
    bodyText: (data) =>
      `You have a conversation scheduled with ${data.otherFirst}.\n\n` +
      `${data.dayLabel} · ${data.timeRange} ${data.tzLabel} (${HTML_LABELS.en.localTimeSuffix})\n\n` +
      `Join here: ${data.joinUrl}\n\n` +
      `The calendar invite is attached. If you can't make it, please cancel in advance so ${data.otherFirst} isn't left waiting.`,
    bodyHtml: (data) => renderHtml(HTML_LABELS.en, data),
    icsSummary: (otherFirst) => `Sondra: Conversation with ${otherFirst}`,
    icsDescription: (joinUrl) =>
      `Join the conversation on Sondra:\n\n${joinUrl}`,
  },
  es: {
    subject: (otherFirst) =>
      `Tu conversación con ${otherFirst} está confirmada`,
    bodyText: (data) =>
      `Tienes una conversación con ${data.otherFirst}.\n\n` +
      `${data.dayLabel} · ${data.timeRange} ${data.tzLabel} (${HTML_LABELS.es.localTimeSuffix})\n\n` +
      `Únete aquí: ${data.joinUrl}\n\n` +
      `La invitación del calendario está adjunta. Si no puedes asistir, cancela con antelación para que ${data.otherFirst} no se quede esperando.`,
    bodyHtml: (data) => renderHtml(HTML_LABELS.es, data),
    icsSummary: (otherFirst) => `Sondra: Conversación con ${otherFirst}`,
    icsDescription: (joinUrl) =>
      `Únete a la conversación en Sondra:\n\n${joinUrl}`,
  },
};

const LOCALE_TO_INTL: Record<LocaleKey, string> = {
  en: 'en-GB',
  es: 'es-ES',
};

export function formatDayLabel(
  scheduledAt: Date,
  locale: LocaleKey,
  timeZone: string,
): string {
  return scheduledAt.toLocaleDateString(LOCALE_TO_INTL[locale], {
    weekday: 'long',
    day: 'numeric',
    month: 'long',
    timeZone,
  });
}

export function formatTimeRange(
  start: Date,
  durationMinutes: number,
  locale: LocaleKey,
  timeZone: string,
): string {
  const end = new Date(start.getTime() + durationMinutes * 60 * 1000);
  const formatTime = (date: Date): string =>
    date.toLocaleTimeString(LOCALE_TO_INTL[locale], {
      hour: '2-digit',
      minute: '2-digit',
      hour12: false,
      timeZone,
    });
  return `${formatTime(start)} – ${formatTime(end)}`;
}

// Short label for the recipient's timezone (e.g. "GMT-4", "EDT", "UTC"),
// taken from the conversation date so DST is reflected correctly.
export function formatTimeZoneLabel(
  date: Date,
  locale: LocaleKey,
  timeZone: string,
): string {
  const parts = new Intl.DateTimeFormat(LOCALE_TO_INTL[locale], {
    timeZone,
    timeZoneName: 'short',
  }).formatToParts(date);
  return parts.find((part) => part.type === 'timeZoneName')?.value ?? timeZone;
}
