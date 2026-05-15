import { EMAIL_COPY, formatDateLabel } from './meeting-email';

describe('EMAIL_COPY', () => {
  it('renders an English subject', () => {
    expect(EMAIL_COPY.en.subject('Bea', 'Mon, 1 Jun, 14:30')).toBe(
      'Sondra: Conversation with Bea on Mon, 1 Jun, 14:30 UTC',
    );
  });

  it('renders a Spanish subject', () => {
    expect(EMAIL_COPY.es.subject('Bea', 'lun, 1 jun, 14:30')).toBe(
      'Sondra: Conversación con Bea el lun, 1 jun, 14:30 UTC',
    );
  });

  it('English plain-text body contains the join URL', () => {
    const text = EMAIL_COPY.en.bodyText(
      'Bea',
      'Mon, 1 Jun, 14:30',
      'https://sondra.test/call/abc',
    );
    expect(text).toContain('Bea');
    expect(text).toContain('https://sondra.test/call/abc');
  });

  it('Spanish plain-text body contains the join URL', () => {
    const text = EMAIL_COPY.es.bodyText(
      'Bea',
      'lun, 1 jun, 14:30',
      'https://sondra.test/call/abc',
    );
    expect(text).toContain('Únete aquí');
    expect(text).toContain('https://sondra.test/call/abc');
  });

  it('English ICS summary uses "Conversation with"', () => {
    expect(EMAIL_COPY.en.icsSummary('Bea')).toBe(
      'Sondra: Conversation with Bea',
    );
  });

  it('Spanish ICS summary uses "Conversación con"', () => {
    expect(EMAIL_COPY.es.icsSummary('Bea')).toBe(
      'Sondra: Conversación con Bea',
    );
  });
});

describe('formatDateLabel', () => {
  const date = new Date('2026-06-01T14:30:00Z');

  it('formats English in en-GB style', () => {
    const label = formatDateLabel(date, 'en');
    expect(label).toMatch(/Mon/);
    expect(label).toContain('14:30');
  });

  it('formats Spanish in es-ES style', () => {
    const label = formatDateLabel(date, 'es');
    expect(label).toContain('14:30');
    // Spanish weekdays start with lowercase letters in Intl
    expect(label).toMatch(/lun/);
  });
});
