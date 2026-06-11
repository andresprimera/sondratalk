import {
  EMAIL_COPY,
  formatDayLabel,
  formatTimeRange,
  formatTimeZoneLabel,
  type MeetingEmailData,
} from './meeting-email';

const sampleData: MeetingEmailData = {
  otherFirst: 'Bea',
  dayLabel: 'Thursday, 12 June',
  timeRange: '11:00 – 12:00',
  tzLabel: 'UTC',
  joinUrl: 'https://sondra.test/call/abc',
};

describe('EMAIL_COPY', () => {
  it('renders an English subject', () => {
    expect(EMAIL_COPY.en.subject('Bea')).toBe(
      'Your conversation with Bea is confirmed',
    );
  });

  it('renders a Spanish subject', () => {
    expect(EMAIL_COPY.es.subject('Bea')).toBe(
      'Tu conversación con Bea está confirmada',
    );
  });

  it('English plain-text body contains the join URL, time, and local-time note', () => {
    const text = EMAIL_COPY.en.bodyText(sampleData);
    expect(text).toContain('Bea');
    expect(text).toContain('Thursday, 12 June');
    expect(text).toContain('11:00 – 12:00 UTC (your local time)');
    expect(text).toContain('https://sondra.test/call/abc');
  });

  it('Spanish plain-text body contains the join URL', () => {
    const text = EMAIL_COPY.es.bodyText(sampleData);
    expect(text).toContain('Únete aquí');
    expect(text).toContain('https://sondra.test/call/abc');
  });

  it('English HTML body renders the mockup card with the name and join link', () => {
    const html = EMAIL_COPY.en.bodyHtml(sampleData);
    expect(html).toContain('Conversation confirmed');
    expect(html).toContain('<strong style="font-weight:600;">Bea</strong>');
    expect(html).toContain('11:00 – 12:00');
    expect(html).toContain('UTC · your local time');
    expect(html).toContain('href="https://sondra.test/call/abc"');
    expect(html).toContain('Join Conversation');
  });

  it('Spanish HTML body uses Spanish labels', () => {
    const html = EMAIL_COPY.es.bodyHtml(sampleData);
    expect(html).toContain('Conversación confirmada');
    expect(html).toContain('Unirme a la conversación');
  });

  it('escapes HTML in the peer name to prevent injection', () => {
    const html = EMAIL_COPY.en.bodyHtml({
      ...sampleData,
      otherFirst: '<script>x</script>',
    });
    expect(html).not.toContain('<script>x</script>');
    expect(html).toContain('&lt;script&gt;');
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

describe('formatDayLabel', () => {
  const date = new Date('2026-06-01T14:30:00Z');

  it('formats English in en-GB style (weekday, day, month)', () => {
    const label = formatDayLabel(date, 'en', 'UTC');
    expect(label).toMatch(/Monday/);
    expect(label).toContain('June');
  });

  it('formats Spanish in es-ES style', () => {
    const label = formatDayLabel(date, 'es', 'UTC');
    expect(label).toMatch(/lunes/);
    expect(label).toContain('junio');
  });
});

describe('formatTimeRange', () => {
  const date = new Date('2026-06-01T14:30:00Z');

  it('renders a start–end range for the given duration in UTC', () => {
    expect(formatTimeRange(date, 60, 'en', 'UTC')).toBe('14:30 – 15:30');
  });

  it('uses the same 24-hour range for Spanish', () => {
    expect(formatTimeRange(date, 60, 'es', 'UTC')).toBe('14:30 – 15:30');
  });

  it("shifts the range into the recipient's timezone", () => {
    // 14:30 UTC is 10:30 in America/New_York (EDT, UTC-4) in June.
    expect(formatTimeRange(date, 60, 'en', 'America/New_York')).toBe(
      '10:30 – 11:30',
    );
  });
});

describe('formatTimeZoneLabel', () => {
  const date = new Date('2026-06-01T14:30:00Z');

  it('returns UTC for the UTC zone', () => {
    expect(formatTimeZoneLabel(date, 'en', 'UTC')).toBe('UTC');
  });

  it("reflects the recipient's offset (DST-aware) for a real zone", () => {
    const label = formatTimeZoneLabel(date, 'en', 'America/New_York');
    expect(label).not.toBe('UTC');
    expect(label).toMatch(/GMT-4|EDT/);
  });
});
