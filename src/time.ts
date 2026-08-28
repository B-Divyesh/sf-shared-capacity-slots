export interface LocalDateTime {
  year: number;
  month: number;
  day: number;
  hour: number;
  minute: number;
  second?: number;
}

const formatterCache = new Map<string, Intl.DateTimeFormat>();

function formatter(timeZone: string): Intl.DateTimeFormat {
  let value = formatterCache.get(timeZone);
  if (!value) {
    value = new Intl.DateTimeFormat('en-CA', {
      timeZone,
      year: 'numeric',
      month: '2-digit',
      day: '2-digit',
      hour: '2-digit',
      minute: '2-digit',
      second: '2-digit',
      hourCycle: 'h23',
    });
    formatterCache.set(timeZone, value);
  }
  return value;
}

export function partsInZone(date: Date, timeZone: string): Required<LocalDateTime> {
  const values: Record<string, number> = {};
  for (const part of formatter(timeZone).formatToParts(date)) {
    if (part.type !== 'literal') values[part.type] = Number(part.value);
  }
  return {
    year: values.year,
    month: values.month,
    day: values.day,
    hour: values.hour,
    minute: values.minute,
    second: values.second,
  };
}

export function zonedDateTimeToDate(local: LocalDateTime, timeZone: string): Date {
  const second = local.second ?? 0;
  const wanted = Date.UTC(local.year, local.month - 1, local.day, local.hour, local.minute, second);
  let candidate = wanted;
  for (let pass = 0; pass < 4; pass += 1) {
    const observed = partsInZone(new Date(candidate), timeZone);
    const observedAsUtc = Date.UTC(
      observed.year,
      observed.month - 1,
      observed.day,
      observed.hour,
      observed.minute,
      observed.second,
    );
    const delta = wanted - observedAsUtc;
    candidate += delta;
    if (delta === 0) break;
  }
  const result = new Date(candidate);
  const finalParts = partsInZone(result, timeZone);
  const matches =
    finalParts.year === local.year &&
    finalParts.month === local.month &&
    finalParts.day === local.day &&
    finalParts.hour === local.hour &&
    finalParts.minute === local.minute;
  if (!matches) throw new Error(`The local time ${formatLocal(local)} does not exist in ${timeZone}.`);
  return result;
}

export function parseLocalDate(value: string): Pick<LocalDateTime, 'year' | 'month' | 'day'> {
  const match = /^(\d{4})-(\d{2})-(\d{2})$/.exec(value);
  if (!match) throw new Error(`Invalid date: ${value}`);
  return { year: Number(match[1]), month: Number(match[2]), day: Number(match[3]) };
}

export function addLocalDays(value: string, days: number): string {
  const parsed = parseLocalDate(value);
  const date = new Date(Date.UTC(parsed.year, parsed.month - 1, parsed.day + days, 12));
  return `${date.getUTCFullYear()}-${String(date.getUTCMonth() + 1).padStart(2, '0')}-${String(date.getUTCDate()).padStart(2, '0')}`;
}

export function weekdayOfLocalDate(value: string): number {
  const parsed = parseLocalDate(value);
  return new Date(Date.UTC(parsed.year, parsed.month - 1, parsed.day, 12)).getUTCDay();
}

export function localDateTime(value: string, time: string): LocalDateTime {
  const date = parseLocalDate(value);
  const match = /^(\d{2}):(\d{2})$/.exec(time);
  if (!match) throw new Error(`Invalid time: ${time}`);
  return { ...date, hour: Number(match[1]), minute: Number(match[2]), second: 0 };
}

export function formatLocal(value: LocalDateTime): string {
  return `${value.year}-${String(value.month).padStart(2, '0')}-${String(value.day).padStart(2, '0')} ${String(value.hour).padStart(2, '0')}:${String(value.minute).padStart(2, '0')}`;
}

export function localDateKey(date: Date, timeZone: string): string {
  const value = partsInZone(date, timeZone);
  return `${value.year}-${String(value.month).padStart(2, '0')}-${String(value.day).padStart(2, '0')}`;
}
