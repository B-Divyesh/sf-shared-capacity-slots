import { describe, expect, it } from 'vitest';
import { partsInZone, zonedDateTimeToDate } from '../../src/time';

describe('timezone conversion', () => {
  it('uses the pre-DST offset immediately before the spring transition', () => {
    const date = zonedDateTimeToDate({ year: 2026, month: 3, day: 8, hour: 1, minute: 30 }, 'America/New_York');
    expect(date.toISOString()).toBe('2026-03-08T06:30:00.000Z');
    expect(partsInZone(date, 'America/New_York').hour).toBe(1);
  });

  it('uses the post-DST offset immediately after the spring transition', () => {
    const date = zonedDateTimeToDate({ year: 2026, month: 3, day: 8, hour: 3, minute: 30 }, 'America/New_York');
    expect(date.toISOString()).toBe('2026-03-08T07:30:00.000Z');
    expect(partsInZone(date, 'America/New_York').hour).toBe(3);
  });

  it('rejects a local wall time that does not exist at spring-forward', () => {
    expect(() => zonedDateTimeToDate({ year: 2026, month: 3, day: 8, hour: 2, minute: 30 }, 'America/New_York')).toThrow(/does not exist/);
  });

  it('preserves local dates across a half-hour timezone', () => {
    const date = zonedDateTimeToDate({ year: 2026, month: 8, day: 28, hour: 9, minute: 15 }, 'Asia/Kolkata');
    expect(date.toISOString()).toBe('2026-08-28T03:45:00.000Z');
  });
});
