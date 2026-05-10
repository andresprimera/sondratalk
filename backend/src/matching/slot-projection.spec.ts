import type { AvailabilityWindow } from '@base-dashboard/shared';
import { projectSlotsForCandidate } from './slot-projection';

describe('projectSlotsForCandidate', () => {
  it('returns empty when there are no windows', () => {
    const result = projectSlotsForCandidate({
      windows: [],
      candidateTz: 'Europe/Madrid',
      requesterTz: 'America/New_York',
      now: new Date('2026-05-10T00:00:00Z'),
    });
    expect(result).toEqual([]);
  });

  it('projects a Tuesday morning window for a Madrid candidate viewed from NYC', () => {
    // 2026-05-10 is a Sunday UTC. Tue offset = 2 from Sunday.
    const windows: AvailabilityWindow[] = [{ day: 'tue', period: 'morning' }];
    const result = projectSlotsForCandidate({
      windows,
      candidateTz: 'Europe/Madrid',
      requesterTz: 'America/New_York',
      now: new Date('2026-05-10T00:00:00Z'),
    });
    // Madrid in May is CEST (UTC+2). 09:00/10:30/12:00 Madrid -> 07:00/08:30/10:00 UTC.
    // NYC in May is EDT (UTC-4). -> 03:00/04:30/06:00 NYC on 2026-05-12.
    expect(result).toEqual([
      {
        startsAt: '2026-05-12T07:00:00.000Z',
        requesterDate: '2026-05-12',
        requesterTime: '03:00',
      },
      {
        startsAt: '2026-05-12T08:30:00.000Z',
        requesterDate: '2026-05-12',
        requesterTime: '04:30',
      },
      {
        startsAt: '2026-05-12T10:00:00.000Z',
        requesterDate: '2026-05-12',
        requesterTime: '06:00',
      },
    ]);
  });

  it('prunes slots that are at or before now', () => {
    // now = 2026-05-12 08:30 UTC = Madrid 10:30 CEST. Madrid morning 10:30 is == now,
    // 09:00 is past, 12:00 is future. So only 12:00 Madrid (10:00 UTC) survives.
    const result = projectSlotsForCandidate({
      windows: [{ day: 'tue', period: 'morning' }],
      candidateTz: 'Europe/Madrid',
      requesterTz: 'Europe/Madrid',
      now: new Date('2026-05-12T08:30:00Z'),
    });
    expect(result).toEqual([
      {
        startsAt: '2026-05-12T10:00:00.000Z',
        requesterDate: '2026-05-12',
        requesterTime: '12:00',
      },
    ]);
  });

  it('caps at maxSlots when many windows produce more', () => {
    // 7 days x 3 slots/day at 3 periods/day = lots; cap should hold.
    const windows: AvailabilityWindow[] = (
      ['mon', 'tue', 'wed', 'thu', 'fri', 'sat', 'sun'] as const
    ).map((day) => ({ day, period: 'morning' as const }));
    const result = projectSlotsForCandidate({
      windows,
      candidateTz: 'UTC',
      requesterTz: 'UTC',
      now: new Date('2026-05-10T00:00:00Z'),
      maxSlots: 6,
    });
    expect(result).toHaveLength(6);
  });

  it('shows a Tokyo morning slot on the previous calendar day in Los Angeles', () => {
    // Tokyo Tue 09:00 = UTC Tue 00:00 = LA Mon 17:00 (PDT, UTC-7 in May).
    const result = projectSlotsForCandidate({
      windows: [{ day: 'tue', period: 'morning' }],
      candidateTz: 'Asia/Tokyo',
      requesterTz: 'America/Los_Angeles',
      now: new Date('2026-05-10T00:00:00Z'),
    });
    expect(result[0]).toEqual({
      startsAt: '2026-05-12T00:00:00.000Z',
      requesterDate: '2026-05-11',
      requesterTime: '17:00',
    });
  });

  it('handles Madrid DST: summer slot lands at 07:00 UTC, winter at 08:00 UTC', () => {
    // Summer (May): Madrid is CEST (UTC+2) -> 09:00 Madrid = 07:00 UTC.
    const summer = projectSlotsForCandidate({
      windows: [{ day: 'tue', period: 'morning' }],
      candidateTz: 'Europe/Madrid',
      requesterTz: 'UTC',
      now: new Date('2026-05-10T00:00:00Z'),
    });
    expect(summer[0].startsAt).toBe('2026-05-12T07:00:00.000Z');

    // Winter (Dec): Madrid is CET (UTC+1) -> 09:00 Madrid = 08:00 UTC.
    const winter = projectSlotsForCandidate({
      windows: [{ day: 'tue', period: 'morning' }],
      candidateTz: 'Europe/Madrid',
      requesterTz: 'UTC',
      now: new Date('2026-12-06T00:00:00Z'),
    });
    expect(winter[0].startsAt).toBe('2026-12-08T08:00:00.000Z');
  });

  it('sorts slots by startsAt ascending and dedupes overlapping startsAt', () => {
    // Two identical windows for the same day+period should produce no duplicates.
    const result = projectSlotsForCandidate({
      windows: [
        { day: 'tue', period: 'morning' },
        { day: 'tue', period: 'morning' },
      ],
      candidateTz: 'UTC',
      requesterTz: 'UTC',
      now: new Date('2026-05-10T00:00:00Z'),
    });
    expect(result).toHaveLength(3);
    expect(result.map((s) => s.startsAt)).toEqual([
      '2026-05-12T09:00:00.000Z',
      '2026-05-12T10:30:00.000Z',
      '2026-05-12T12:00:00.000Z',
    ]);
  });
});
