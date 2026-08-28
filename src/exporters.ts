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
  const parsed = JSON.parse(text) as { product?: unknown; state?: unknown };
  if (parsed.product !== 'shared-capacity-slots' || !isValidState(parsed.state)) {
    throw new Error('This is not a valid Shared Capacity Slots backup.');
  }
  return parsed.state;
}

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === 'object' && value !== null;
}

function isText(value: unknown, maximum = 500): value is string {
  return typeof value === 'string' && value.length <= maximum;
}

function isValidState(value: unknown): value is AppState {
  if (!isRecord(value) || value.version !== 1 || !Array.isArray(value.resources) || !Array.isArray(value.services) || !Array.isArray(value.busyBlocks) || !Array.isArray(value.history)) return false;
  if (!isText(value.timezone, 100) || ![15, 30, 60].includes(Number(value.slotStepMinutes))) return false;
  try { new Intl.DateTimeFormat('en', { timeZone: value.timezone }).format(); } catch { return false; }
  const resourcesValid = value.resources.every((resource) => isRecord(resource)
    && isText(resource.id, 200) && isText(resource.name, 60)
    && ['person', 'room', 'equipment', 'other'].includes(String(resource.kind))
    && isRecord(resource.workingHours) && Array.isArray(resource.workingHours.weekdays)
    && resource.workingHours.weekdays.every((day) => Number.isInteger(day) && Number(day) >= 0 && Number(day) <= 6)
    && isText(resource.workingHours.start, 5) && /^\d{2}:\d{2}$/.test(resource.workingHours.start)
    && isText(resource.workingHours.end, 5) && /^\d{2}:\d{2}$/.test(resource.workingHours.end));
  const servicesValid = value.services.every((service) => isRecord(service)
    && isText(service.id, 200) && isText(service.name, 60)
    && Number.isFinite(service.durationMinutes) && Number(service.durationMinutes) >= 15 && Number(service.durationMinutes) <= 480
    && Array.isArray(service.requirements) && service.requirements.every((requirement) => isRecord(requirement)
      && isText(requirement.id, 200) && isText(requirement.label, 60)
      && Number.isInteger(requirement.quantity) && Number(requirement.quantity) >= 1
      && Array.isArray(requirement.resourceIds) && requirement.resourceIds.every((resourceId) => isText(resourceId, 200))));
  const blocksValid = value.busyBlocks.every((block) => isRecord(block)
    && isText(block.id, 300) && isText(block.resourceId, 200) && isText(block.summary, 500) && isText(block.source, 500)
    && isText(block.start, 50) && isText(block.end, 50)
    && Number.isFinite(Date.parse(block.start)) && Number.isFinite(Date.parse(block.end)) && Date.parse(block.start) < Date.parse(block.end));
  const historyValid = value.history.every((entry) => isRecord(entry)
    && isText(entry.id, 200) && isText(entry.at, 50) && isText(entry.message, 500) && Number.isFinite(Date.parse(entry.at)));
  return resourcesValid && servicesValid && blocksValid && historyValid;
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
