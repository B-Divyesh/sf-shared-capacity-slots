import { describe, expect, it } from 'vitest';
import { parseIcs } from '../../src/ics';

describe('ICS import', () => {
  it('unfolds fields and respects TZID across a DST boundary', () => {
    const result = parseIcs(`BEGIN:VCALENDAR\r\nBEGIN:VEVENT\r\nUID:dst-1\r\nDTSTART;TZID=America/New_York:20260308T033000\r\nDTEND;TZID=America/New_York:20260308T043000\r\nSUMMARY:After spring-\r\n forward\r\nEND:VEVENT\r\nEND:VCALENDAR`, 'maya', 'maya.ics', 'UTC');
    expect(result.blocks).toHaveLength(1);
    expect(result.blocks[0].start).toBe('2026-03-08T07:30:00.000Z');
    expect(result.blocks[0].end).toBe('2026-03-08T08:30:00.000Z');
    expect(result.blocks[0].summary).toBe('After spring-forward');
  });

  it('parses UTC and local all-day events', () => {
    const result = parseIcs(`BEGIN:VCALENDAR
BEGIN:VEVENT
UID:utc
DTSTART:20260828T120000Z
DTEND:20260828T130000Z
SUMMARY:UTC event
END:VEVENT
BEGIN:VEVENT
UID:day
DTSTART;VALUE=DATE:20260829
DTEND;VALUE=DATE:20260830
SUMMARY:Closed
END:VEVENT
END:VCALENDAR`, 'room', 'room.ics', 'Asia/Kolkata');
    expect(result.blocks[0].start).toBe('2026-08-28T12:00:00.000Z');
    expect(result.blocks[1].start).toBe('2026-08-28T18:30:00.000Z');
    expect(result.blocks[1].end).toBe('2026-08-29T18:30:00.000Z');
  });

  it('reports malformed events without dropping good events', () => {
    const result = parseIcs(`BEGIN:VCALENDAR
BEGIN:VEVENT
UID:good
DTSTART:20260828T120000Z
DTEND:20260828T130000Z
END:VEVENT
BEGIN:VEVENT
UID:bad
SUMMARY:No date
END:VEVENT
END:VCALENDAR`, 'room', 'mixed.ics', 'UTC');
    expect(result.blocks).toHaveLength(1);
    expect(result.skipped).toBe(1);
  });

  it('expands weekly recurrence in wall time across daylight saving', () => {
    const result = parseIcs(`BEGIN:VCALENDAR
BEGIN:VEVENT
UID:weekly
DTSTART;TZID=America/New_York:20260301T090000
DTEND;TZID=America/New_York:20260301T100000
RRULE:FREQ=WEEKLY;COUNT=3;BYDAY=SU
SUMMARY:Weekly opening prep
END:VEVENT
END:VCALENDAR`, 'room', 'weekly.ics', 'UTC');
    expect(result.blocks.map((block) => block.start)).toEqual([
      '2026-03-01T14:00:00.000Z',
      '2026-03-08T13:00:00.000Z',
      '2026-03-15T13:00:00.000Z',
    ]);
  });

  it('honors recurrence exceptions', () => {
    const result = parseIcs(`BEGIN:VCALENDAR
BEGIN:VEVENT
UID:daily
DTSTART:20260828T090000Z
DTEND:20260828T100000Z
RRULE:FREQ=DAILY;COUNT=3
EXDATE:20260829T090000Z
END:VEVENT
END:VCALENDAR`, 'room', 'daily.ics', 'UTC');
    expect(result.blocks.map((block) => block.start)).toEqual([
      '2026-08-28T09:00:00.000Z',
      '2026-08-30T09:00:00.000Z',
    ]);
  });

  it('rejects files without VEVENT entries', () => {
    expect(() => parseIcs('BEGIN:VCALENDAR\nEND:VCALENDAR', 'room', 'empty.ics', 'UTC')).toThrow(/No calendar events/);
  });
});
