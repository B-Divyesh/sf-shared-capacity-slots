import type { AppState, Calculation, Service } from './types';

function escapeCsv(value: string | number): string {
  const text = String(value);
  return /[",\n]/.test(text) ? `"${text.replaceAll('"', '""')}"` : text;
}

function icsDate(value: string): string {
  return new Date(value).toISOString().replace(/[-:]/g, '').replace('.000', '');
}

function foldIcs(line: string): string {
  if (line.length <= 73) return line;
  const parts: string[] = [];
  let rest = line;
  while (rest.length > 73) {
    parts.push(rest.slice(0, 73));
    rest = ` ${rest.slice(73)}`;
  }
  parts.push(rest);
  return parts.join('\r\n');
}

export function calculationToCsv(calculation: Calculation, service: Service, timezone: string): string {
  const formatter = new Intl.DateTimeFormat('en-CA', {
    timeZone: timezone,
    dateStyle: 'short',
    timeStyle: 'short',
    hour12: false,
  });
  const rows = [['Service', 'Start', 'End', 'Timezone', 'Parallel capacity']];
  calculation.slots.forEach((slot) => {
    rows.push([
      service.name,
      formatter.format(new Date(slot.start)),
      formatter.format(new Date(slot.end)),
      timezone,
      String(slot.capacity),
    ]);
  });
  return rows.map((row) => row.map(escapeCsv).join(',')).join('\n');
}

export function calculationToIcs(calculation: Calculation, service: Service): string {
  const periods = calculation.slots.map((slot) => `${icsDate(slot.start)}/${icsDate(slot.end)}`);
  const lines = [
    'BEGIN:VCALENDAR',
    'VERSION:2.0',
    'PRODID:-//Sociobot//Shared Capacity Slots//EN',
    'METHOD:PUBLISH',
    'X-WR-CALNAME:Advisory availability',
    'BEGIN:VFREEBUSY',
    `UID:${crypto.randomUUID()}@shared-capacity-slots.sociobot.in`,
    `DTSTAMP:${icsDate(new Date().toISOString())}`,
    `COMMENT:Advisory availability for ${service.name.replaceAll(',', '\\,')}; not bookings`,
    ...periods.map((period) => `FREEBUSY;FBTYPE=FREE:${period}`),
    'END:VFREEBUSY',
    'END:VCALENDAR',
  ];
  return `${lines.map(foldIcs).join('\r\n')}\r\n`;
}

export function stateToJson(state: AppState): string {
  return JSON.stringify({ product: 'shared-capacity-slots', exportedAt: new Date().toISOString(), state }, null, 2);
}

export function jsonToState(text: string): AppState {
  const parsed = JSON.parse(text) as { product?: string; state?: AppState };
  if (parsed.product !== 'shared-capacity-slots' || parsed.state?.version !== 1) {
    throw new Error('This is not a valid Shared Capacity Slots backup.');
  }
  return parsed.state;
}

export function downloadFile(contents: string, filename: string, type: string): void {
  const blob = new Blob([contents], { type });
  const url = URL.createObjectURL(blob);
  const anchor = document.createElement('a');
  anchor.href = url;
  anchor.download = filename;
  anchor.click();
  setTimeout(() => URL.revokeObjectURL(url), 1000);
}
