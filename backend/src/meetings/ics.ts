export interface BuildMeetingIcsArgs {
  meetingId: string;
  organizerEmail: string;
  attendeeEmail: string;
  attendeeName: string;
  summary: string;
  description: string;
  scheduledAt: Date;
  durationMinutes: number;
  joinUrl: string;
}

export interface MeetingIcs {
  content: string;
  filename: string;
}

function formatIcsDate(d: Date): string {
  const pad = (n: number): string => (n < 10 ? `0${n}` : `${n}`);
  return (
    `${d.getUTCFullYear()}` +
    pad(d.getUTCMonth() + 1) +
    pad(d.getUTCDate()) +
    'T' +
    pad(d.getUTCHours()) +
    pad(d.getUTCMinutes()) +
    pad(d.getUTCSeconds()) +
    'Z'
  );
}

function escapeIcsText(s: string): string {
  return s
    .replace(/\\/g, '\\\\')
    .replace(/;/g, '\\;')
    .replace(/,/g, '\\,')
    .replace(/\r?\n/g, '\\n');
}

export function buildMeetingIcs(args: BuildMeetingIcsArgs): MeetingIcs {
  const dtStart = formatIcsDate(args.scheduledAt);
  const dtEnd = formatIcsDate(
    new Date(args.scheduledAt.getTime() + args.durationMinutes * 60 * 1000),
  );
  const dtStamp = formatIcsDate(new Date());

  const lines = [
    'BEGIN:VCALENDAR',
    'VERSION:2.0',
    'PRODID:-//Sondra//EN',
    'CALSCALE:GREGORIAN',
    'METHOD:REQUEST',
    'BEGIN:VEVENT',
    `UID:${args.meetingId}@sondra`,
    `DTSTAMP:${dtStamp}`,
    `DTSTART:${dtStart}`,
    `DTEND:${dtEnd}`,
    `SUMMARY:${escapeIcsText(args.summary)}`,
    `DESCRIPTION:${escapeIcsText(args.description)}`,
    `URL:${args.joinUrl}`,
    `LOCATION:${escapeIcsText(args.joinUrl)}`,
    `ORGANIZER;CN=Sondra:mailto:${args.organizerEmail}`,
    `ATTENDEE;CN=${escapeIcsText(args.attendeeName)};RSVP=TRUE:mailto:${args.attendeeEmail}`,
    'END:VEVENT',
    'END:VCALENDAR',
  ];

  return {
    content: lines.join('\r\n') + '\r\n',
    filename: 'sondra-meeting.ics',
  };
}
