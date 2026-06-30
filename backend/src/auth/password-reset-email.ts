import type { LocaleKey } from '@base-dashboard/shared';

export interface ResetEmailCopy {
  subject: string;
  bodyText(resetUrl: string): string;
  bodyHtml(resetUrl: string): string;
}

interface ResetLabels {
  lang: string;
  headerLabel: string;
  heading: string;
  intro: string;
  cta: string;
  expiryNote: string;
  ignoreNote: string;
}

function escapeHtml(value: string): string {
  return value
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;');
}

// Branded, email-client-safe reset email. Mirrors the palette and table-based
// structure of the meeting confirmation email (see meetings/meeting-email.ts)
// so transactional mail stays visually consistent.
function renderHtml(labels: ResetLabels, resetUrl: string): string {
  const url = escapeHtml(resetUrl);
  const appOrigin = escapeHtml(new URL(resetUrl).origin);
  const appHost = escapeHtml(new URL(resetUrl).hostname);
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
    '<tr><td style="height:3px;background:#4d8a60;font-size:0;line-height:0;">&nbsp;</td></tr>' +
    '<tr><td style="padding:28px 36px 22px;border-bottom:1px solid rgba(232,220,196,0.07);">' +
    '<table role="presentation" width="100%" cellpadding="0" cellspacing="0" border="0"><tr>' +
    '<td style="font-size:20px;font-weight:500;letter-spacing:1px;color:#e8dcc4;">Sondra</td>' +
    `<td align="right" style="font-size:11px;letter-spacing:2px;text-transform:uppercase;color:#4d8a60;">${labels.headerLabel}</td>` +
    '</tr></table></td></tr>' +
    '<tr><td style="padding:34px 36px;">' +
    `<h1 style="margin:0 0 18px;font-size:24px;font-weight:400;color:#e8dcc4;line-height:1.35;">${labels.heading}</h1>` +
    `<p style="margin:0 0 26px;font-size:16px;color:#a89878;line-height:1.7;">${labels.intro}</p>` +
    '<table role="presentation" width="100%" cellpadding="0" cellspacing="0" border="0"><tr>' +
    '<td align="center" style="border-radius:10px;background:#4d8a60;">' +
    `<a href="${url}" style="display:block;padding:15px 20px;font-family:${serif};font-size:17px;font-weight:600;letter-spacing:1px;color:#e8f2ec;text-decoration:none;text-align:center;">${labels.cta}</a>` +
    '</td></tr></table>' +
    `<p style="margin:18px 0 0;font-size:13px;font-style:italic;color:#6f6650;text-align:center;line-height:1.55;">${labels.expiryNote}</p>` +
    '<hr style="border:none;border-top:1px solid rgba(232,220,196,0.08);margin:30px 0 22px;">' +
    `<p style="margin:0;font-size:12px;color:#5f5848;line-height:1.65;text-align:center;">${labels.ignoreNote}</p>` +
    '</td></tr>' +
    '<tr><td style="padding:20px 36px 30px;border-top:1px solid rgba(232,220,196,0.05);">' +
    '<table role="presentation" width="100%" cellpadding="0" cellspacing="0" border="0"><tr>' +
    '<td style="font-size:13px;letter-spacing:1px;color:#6f6650;">Sondra</td>' +
    `<td align="right"><a href="${appOrigin}" style="font-size:12px;color:#6f6650;text-decoration:none;letter-spacing:0.5px;">${appHost}</a></td>` +
    '</tr></table></td></tr>' +
    '</table></td></tr></table></body></html>'
  );
}

const LABELS: Record<LocaleKey, ResetLabels> = {
  en: {
    lang: 'en',
    headerLabel: 'Password reset',
    heading: 'Reset your password',
    intro:
      'We got a request to reset your Sondra password. Tap the button below to choose a new one.',
    cta: 'Reset password',
    expiryNote: 'This link expires in 1 hour.',
    ignoreNote:
      "If you didn't request this, you can safely ignore this email — your password won't change.",
  },
  es: {
    lang: 'es',
    headerLabel: 'Restablecer contraseña',
    heading: 'Restablece tu contraseña',
    intro:
      'Recibimos una solicitud para restablecer tu contraseña de Sondra. Toca el botón de abajo para elegir una nueva.',
    cta: 'Restablecer contraseña',
    expiryNote: 'Este enlace caduca en 1 hora.',
    ignoreNote:
      'Si no fuiste tú, puedes ignorar este correo sin problema — tu contraseña no cambiará.',
  },
};

export const PASSWORD_RESET_EMAIL_COPY: Record<LocaleKey, ResetEmailCopy> = {
  en: {
    subject: 'Reset your Sondra password',
    bodyText: (resetUrl) =>
      `We got a request to reset your Sondra password.\n\n` +
      `Reset it here: ${resetUrl}\n\n` +
      `This link expires in 1 hour. If you didn't request this, you can ignore this email.`,
    bodyHtml: (resetUrl) => renderHtml(LABELS.en, resetUrl),
  },
  es: {
    subject: 'Restablece tu contraseña de Sondra',
    bodyText: (resetUrl) =>
      `Recibimos una solicitud para restablecer tu contraseña de Sondra.\n\n` +
      `Restablécela aquí: ${resetUrl}\n\n` +
      `Este enlace caduca en 1 hora. Si no fuiste tú, puedes ignorar este correo.`,
    bodyHtml: (resetUrl) => renderHtml(LABELS.es, resetUrl),
  },
};
