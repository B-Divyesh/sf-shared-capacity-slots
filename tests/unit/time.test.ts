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

  it('chooses the first occurrence of an ambiguous fall-back time', () => {
    const newYork = zonedDateTimeToDate({ year: 2026, month: 11, day: 1, hour: 1, minute: 30 }, 'America/New_York');
    const berlin = zonedDateTimeToDate({ year: 2026, month: 10, day: 25, hour: 2, minute: 30 }, 'Europe/Berlin');
    expect(newYork.toISOString()).toBe('2026-11-01T05:30:00.000Z');
    expect(berlin.toISOString()).toBe('2026-10-25T00:30:00.000Z');
  });

  it('handles a southern-hemisphere fall-back boundary', () => {
    const date = zonedDateTimeToDate({ year: 2026, month: 4, day: 5, hour: 2, minute: 30 }, 'Pacific/Auckland');
    expect(date.toISOString()).toBe('2026-04-04T13:30:00.000Z');
  });

  it('handles Lord Howe Island half-hour DST transitions', () => {
    const repeated = zonedDateTimeToDate({ year: 2026, month: 4, day: 5, hour: 1, minute: 45 }, 'Australia/Lord_Howe');
    expect(repeated.toISOString()).toBe('2026-04-04T14:45:00.000Z');
    expect(() => zonedDateTimeToDate({ year: 2026, month: 10, day: 4, hour: 2, minute: 15 }, 'Australia/Lord_Howe')).toThrow(/does not exist/);
    const after = zonedDateTimeToDate({ year: 2026, month: 10, day: 4, hour: 2, minute: 45 }, 'Australia/Lord_Howe');
    expect(after.toISOString()).toBe('2026-10-03T15:45:00.000Z');
  });

  it('rejects a southern-hemisphere spring-forward time', () => {
    expect(() => zonedDateTimeToDate({ year: 2026, month: 9, day: 27, hour: 2, minute: 30 }, 'Pacific/Auckland')).toThrow(/does not exist/);
  });

  it('@claim:timezone-boundaries handles gaps, repeats, hemispheres, and fractional DST', () => {
    expect(zonedDateTimeToDate({ year: 2026, month: 11, day: 1, hour: 1, minute: 30 }, 'America/New_York').toISOString()).toBe('2026-11-01T05:30:00.000Z');
    expect(zonedDateTimeToDate({ year: 2026, month: 10, day: 25, hour: 2, minute: 30 }, 'Europe/Berlin').toISOString()).toBe('2026-10-25T00:30:00.000Z');
    expect(zonedDateTimeToDate({ year: 2026, month: 4, day: 5, hour: 2, minute: 30 }, 'Pacific/Auckland').toISOString()).toBe('2026-04-04T13:30:00.000Z');
    expect(zonedDateTimeToDate({ year: 2026, month: 4, day: 5, hour: 1, minute: 45 }, 'Australia/Lord_Howe').toISOString()).toBe('2026-04-04T14:45:00.000Z');
    expect(() => zonedDateTimeToDate({ year: 2026, month: 3, day: 8, hour: 2, minute: 30 }, 'America/New_York')).toThrow(/does not exist/);
    expect(() => zonedDateTimeToDate({ year: 2026, month: 9, day: 27, hour: 2, minute: 30 }, 'Pacific/Auckland')).toThrow(/does not exist/);
    expect(() => zonedDateTimeToDate({ year: 2026, month: 10, day: 4, hour: 2, minute: 15 }, 'Australia/Lord_Howe')).toThrow(/does not exist/);
  });
});
