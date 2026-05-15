import { buildMeetingIcs } from './ics';

const BASE_ARGS = {
  meetingId: '507f1f77bcf86cd799439aaa',
  organizerEmail: 'noreply@sondra.test',
  attendeeEmail: 'ana@example.com',
  attendeeName: 'Ana María',
  summary: 'Sondra: Conversation with Bea',
  description: 'Join the conversation:\n\nhttps://sondra.test/call/abc',
  scheduledAt: new Date('2026-06-01T14:30:00Z'),
  durationMinutes: 60,
  joinUrl: 'https://sondra.test/call/abc',
};

describe('buildMeetingIcs', () => {
  it('wraps the event in BEGIN/END VCALENDAR with CRLF line endings', () => {
    const { content } = buildMeetingIcs(BASE_ARGS);
    expect(content.startsWith('BEGIN:VCALENDAR\r\n')).toBe(true);
    expect(content.endsWith('END:VCALENDAR\r\n')).toBe(true);
  });

  it('formats DTSTART and DTEND in UTC YYYYMMDDTHHMMSSZ form', () => {
    const { content } = buildMeetingIcs(BASE_ARGS);
    expect(content).toMatch(/DTSTART:20260601T143000Z/);
    expect(content).toMatch(/DTEND:20260601T153000Z/);
  });

  it('honours durationMinutes', () => {
    const { content } = buildMeetingIcs({ ...BASE_ARGS, durationMinutes: 15 });
    expect(content).toMatch(/DTSTART:20260601T143000Z/);
    expect(content).toMatch(/DTEND:20260601T144500Z/);
  });

  it('uses <id>@sondra as the UID', () => {
    const { content } = buildMeetingIcs(BASE_ARGS);
    expect(content).toMatch(/UID:507f1f77bcf86cd799439aaa@sondra/);
  });

  it('escapes commas in SUMMARY', () => {
    const { content } = buildMeetingIcs({
      ...BASE_ARGS,
      summary: 'Sondra, your conversation',
    });
    expect(content).toMatch(/SUMMARY:Sondra\\, your conversation/);
  });

  it('escapes newlines in DESCRIPTION to \\n', () => {
    const { content } = buildMeetingIcs(BASE_ARGS);
    expect(content).toMatch(/DESCRIPTION:Join the conversation:\\n\\nhttps/);
  });

  it('includes ORGANIZER and ATTENDEE mailto entries', () => {
    const { content } = buildMeetingIcs(BASE_ARGS);
    expect(content).toMatch(/ORGANIZER;CN=Sondra:mailto:noreply@sondra.test/);
    expect(content).toMatch(
      /ATTENDEE;CN=Ana María;RSVP=TRUE:mailto:ana@example.com/,
    );
  });

  it('returns the fixed filename', () => {
    const { filename } = buildMeetingIcs(BASE_ARGS);
    expect(filename).toBe('sondra-meeting.ics');
  });
});
