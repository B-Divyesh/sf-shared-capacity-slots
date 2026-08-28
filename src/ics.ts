import { addLocalDays, partsInZone, weekdayOfLocalDate, zonedDateTimeToDate, type LocalDateTime } from './time';
import type { BusyBlock } from './types';

interface ParsedDate {
  date: Date;
  allDay: boolean;
  local: LocalDateTime;
  timeZone: string;
}

function unfold(text: string): string[] {
  return text.replace(/\r\n[ \t]/g, '').replace(/\n[ \t]/g, '').split(/\r?\n/);
}

function unescapeText(value: string): string {
  return value.replace(/\\n/gi, ' ').replace(/\\,/g, ',').replace(/\\;/g, ';').replace(/\\\\/g, '\\');
}

function parseIcsDate(raw: string, parameters: string, defaultTimeZone: string): ParsedDate {
  const value = raw.trim();
  const allDay = /VALUE=DATE(?:;|$)/i.test(parameters) || /^\d{8}$/.test(value);
  const match = /^(\d{4})(\d{2})(\d{2})(?:T(\d{2})(\d{2})(\d{2})?)?(Z)?$/.exec(value);
  if (!match) throw new Error(`Unsupported calendar date: ${value}`);
  const local: LocalDateTime = {
    year: Number(match[1]),
    month: Number(match[2]),
    day: Number(match[3]),
    hour: Number(match[4] ?? 0),
    minute: Number(match[5] ?? 0),
    second: Number(match[6] ?? 0),
  };
  if (match[7]) {
    return {
      date: new Date(Date.UTC(local.year, local.month - 1, local.day, local.hour, local.minute, local.second)),
      allDay,
      local,
      timeZone: 'UTC',
    };
  }
  const tzMatch = /(?:^|;)TZID=([^;:]+)/i.exec(parameters);
  const timeZone = tzMatch ? tzMatch[1].replace(/^"|"$/g, '') : defaultTimeZone;
  return { date: zonedDateTimeToDate(local, timeZone), allDay, local, timeZone };
}

function dateKey(local: LocalDateTime): string {
  return `${local.year}-${String(local.month).padStart(2, '0')}-${String(local.day).padStart(2, '0')}`;
}

function daysBetween(start: string, end: string): number {
  const parse = (value: string) => {
    const [year, month, day] = value.split('-').map(Number);
    return Date.UTC(year, month - 1, day, 12);
  };
  return Math.round((parse(end) - parse(start)) / 86_400_000);
}

function recurrenceStarts(event: string[], start: ParsedDate, startParams: string, defaultTimeZone: string): Date[] {
  const ruleLine = event.find((line) => line.toUpperCase().startsWith('RRULE:'));
  if (!ruleLine) return [start.date];
  const fields = Object.fromEntries(ruleLine.slice(6).split(';').map((part) => {
    const separator = part.indexOf('=');
    return [part.slice(0, separator).toUpperCase(), part.slice(separator + 1)];
  }));
  const supportedFields = new Set(['FREQ', 'INTERVAL', 'COUNT', 'UNTIL', 'BYDAY', 'BYMONTHDAY', 'WKST']);
  const unsupported = Object.keys(fields).find((field) => !supportedFields.has(field));
  if (unsupported) throw new Error(`Unsupported recurrence field: ${unsupported}`);
  const frequency = fields.FREQ;
  if (!['DAILY', 'WEEKLY', 'MONTHLY'].includes(frequency)) throw new Error(`Unsupported recurrence frequency: ${frequency || 'missing'}`);
  if (frequency === 'WEEKLY' && fields.BYMONTHDAY) throw new Error('BYMONTHDAY is not supported for weekly recurrence');
  if (frequency === 'MONTHLY' && fields.BYDAY) throw new Error('BYDAY is not supported for monthly recurrence');
  const interval = Math.max(1, Number(fields.INTERVAL ?? 1));
  const count = fields.COUNT ? Math.max(1, Number(fields.COUNT)) : Number.POSITIVE_INFINITY;
  const until = fields.UNTIL ? parseIcsDate(fields.UNTIL, startParams, defaultTimeZone).date : null;
  const byDays = (fields.BYDAY ?? '').split(',').filter(Boolean).map((value) => value.slice(-2));
  const byMonthDays = (fields.BYMONTHDAY ?? String(start.local.day)).split(',').map(Number);
  const weekdayCodes = ['SU', 'MO', 'TU', 'WE', 'TH', 'FR', 'SA'];
  const weekStart = weekdayCodes.indexOf(fields.WKST ?? 'MO');
  if (weekStart < 0 || byDays.some((day) => !weekdayCodes.includes(day))) throw new Error('Unsupported recurrence weekday');
  const originalKey = dateKey(start.local);
  const now = partsInZone(new Date(), start.timeZone);
  const windowStart = addLocalDays(dateKey(now), -370);
  const windowEnd = addLocalDays(dateKey(now), 730);
  const exceptionStarts = new Set(event
    .filter((line) => line.toUpperCase().startsWith('EXDATE'))
    .flatMap((line) => {
      const separator = line.indexOf(':');
      const params = line.slice(0, separator);
      return line.slice(separator + 1).split(',').map((value) => parseIcsDate(value, params, defaultTimeZone).date.toISOString());
    }));
  const starts: Date[] = [];
  let seen = 0;
  let candidateKey = originalKey;
  let iterations = 0;
  while (candidateKey <= windowEnd && seen < count && iterations < 100_000) {
    const difference = daysBetween(originalKey, candidateKey);
    const candidateWeekday = weekdayOfLocalDate(candidateKey);
    const candidateDate = new Date(`${candidateKey}T12:00:00Z`);
    const originalDate = new Date(`${originalKey}T12:00:00Z`);
    const monthDifference = (candidateDate.getUTCFullYear() - originalDate.getUTCFullYear()) * 12 + candidateDate.getUTCMonth() - originalDate.getUTCMonth();
    const originalWeekStart = addLocalDays(originalKey, -((weekdayOfLocalDate(originalKey) - weekStart + 7) % 7));
    const candidateWeekStart = addLocalDays(candidateKey, -((candidateWeekday - weekStart + 7) % 7));
    const weekDifference = daysBetween(originalWeekStart, candidateWeekStart) / 7;
    const matches = frequency === 'DAILY'
      ? difference % interval === 0 && (byDays.length === 0 || byDays.includes(weekdayCodes[candidateWeekday]))
      : frequency === 'WEEKLY'
        ? weekDifference % interval === 0 && (byDays.length ? byDays.includes(weekdayCodes[candidateWeekday]) : candidateWeekday === weekdayOfLocalDate(originalKey))
        : monthDifference >= 0 && monthDifference % interval === 0 && byMonthDays.includes(candidateDate.getUTCDate());
    if (matches) {
      seen += 1;
      const [year, month, day] = candidateKey.split('-').map(Number);
      try {
        const occurrence = zonedDateTimeToDate({ ...start.local, year, month, day }, start.timeZone);
        if ((!until || occurrence <= until) && candidateKey >= windowStart && !exceptionStarts.has(occurrence.toISOString())) starts.push(occurrence);
        if (until && occurrence > until) break;
      } catch {
        // A recurring wall time inside a DST gap is not a valid busy interval.
      }
    }
    candidateKey = addLocalDays(candidateKey, 1);
    iterations += 1;
  }
  return starts;
}

export interface IcsImportResult {
  blocks: BusyBlock[];
  skipped: number;
}

export function parseIcs(text: string, resourceId: string, source: string, defaultTimeZone: string): IcsImportResult {
  const lines = unfold(text);
  const events: string[][] = [];
  let current: string[] | null = null;
  for (const line of lines) {
    if (line === 'BEGIN:VEVENT') current = [];
    else if (line === 'END:VEVENT' && current) {
      events.push(current);
      current = null;
    } else if (current) current.push(line);
  }
  if (events.length === 0) throw new Error('No calendar events were found in this ICS file.');

  const blocks: BusyBlock[] = [];
  let skipped = 0;
  for (const [index, event] of events.entries()) {
    try {
      const find = (name: string) => event.find((line) => line.toUpperCase().startsWith(name));
      const startLine = find('DTSTART');
      const endLine = find('DTEND');
      if (!startLine) throw new Error('Missing start');
      const splitLine = (line: string): [string, string] => {
        const separator = line.indexOf(':');
        if (separator < 0) throw new Error('Malformed field');
        return [line.slice(0, separator), line.slice(separator + 1)];
      };
      const [startParams, startValue] = splitLine(startLine);
      const start = parseIcsDate(startValue, startParams, defaultTimeZone);
      let endDate: Date;
      if (endLine) {
        const [endParams, endValue] = splitLine(endLine);
        endDate = parseIcsDate(endValue, endParams, defaultTimeZone).date;
      } else if (start.allDay) {
        const dateKey = `${startValue.slice(0, 4)}-${startValue.slice(4, 6)}-${startValue.slice(6, 8)}`;
        const next = addLocalDays(dateKey, 1).replaceAll('-', '');
        endDate = parseIcsDate(next, 'VALUE=DATE', defaultTimeZone).date;
      } else {
        endDate = new Date(start.date.getTime() + 60 * 60 * 1000);
      }
      if (endDate <= start.date) throw new Error('End is not after start');
      const summaryLine = find('SUMMARY');
      const summary = summaryLine ? unescapeText(splitLine(summaryLine)[1]) : 'Busy';
      const uidLine = find('UID');
      const uid = (uidLine ? splitLine(uidLine)[1] : `${start.date.getTime()}-${index}`).replace(/[^a-zA-Z0-9_.@-]/g, '_');
      const duration = endDate.getTime() - start.date.getTime();
      const occurrences = recurrenceStarts(event, start, startParams, defaultTimeZone);
      occurrences.forEach((occurrence, occurrenceIndex) => blocks.push({
        id: `ics-${resourceId}-${uid}-${index}-${occurrenceIndex}`,
        resourceId,
        summary,
        start: occurrence.toISOString(),
        end: new Date(occurrence.getTime() + duration).toISOString(),
        source,
      }));
    } catch {
      skipped += 1;
    }
  }
  if (blocks.length === 0) throw new Error('The calendar events did not contain usable start and end times.');
  return { blocks, skipped };
}
