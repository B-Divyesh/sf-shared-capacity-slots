import { addLocalDays, localDateTime, weekdayOfLocalDate, zonedDateTimeToDate } from './time';
import type { BusyBlock, Calculation, Requirement, Resource, Service, Slot } from './types';

export interface CalculationInput {
  resources: Resource[];
  service: Service;
  busyBlocks: BusyBlock[];
  timezone: string;
  startDate: string;
  days: number;
  stepMinutes: number;
}

function combinations(values: string[], quantity: number): string[][] {
  if (quantity <= 0) return [[]];
  const output: string[][] = [];
  const walk = (start: number, chosen: string[]) => {
    if (chosen.length === quantity) {
      output.push(chosen);
      return;
    }
    for (let index = start; index < values.length; index += 1) {
      walk(index + 1, [...chosen, values[index]]);
    }
  };
  walk(0, []);
  return output;
}

function allocations(requirements: Requirement[], availableIds: Set<string>): string[][] {
  let partial: string[][] = [[]];
  for (const requirement of requirements) {
    const eligible = requirement.resourceIds.filter((id) => availableIds.has(id));
    const choices = combinations(eligible, requirement.quantity);
    const next: string[][] = [];
    for (const current of partial) {
      for (const choice of choices) {
        if (choice.every((id) => !current.includes(id))) next.push([...current, ...choice]);
      }
    }
    partial = next;
  }
  return partial;
}

function maxDisjointCapacity(possible: string[][]): { capacity: number; example: string[] } {
  let best = 0;
  let first: string[] = [];
  const walk = (index: number, used: Set<string>, count: number) => {
    if (count + (possible.length - index) <= best) return;
    if (index === possible.length) {
      if (count > best) best = count;
      return;
    }
    walk(index + 1, used, count);
    const candidate = possible[index];
    if (candidate.every((id) => !used.has(id))) {
      const next = new Set(used);
      candidate.forEach((id) => next.add(id));
      walk(index + 1, next, count + 1);
    }
  };
  if (possible[0]) first = possible[0];
  walk(0, new Set(), 0);
  return { capacity: best, example: first };
}

function isWorking(resource: Resource, date: string, startMinute: number, endMinute: number): boolean {
  const hours = resource.workingHours;
  if (!hours.weekdays.includes(weekdayOfLocalDate(date))) return false;
  const [startHour, startPart] = hours.start.split(':').map(Number);
  const [endHour, endPart] = hours.end.split(':').map(Number);
  const resourceStart = startHour * 60 + startPart;
  const resourceEnd = endHour * 60 + endPart;
  return startMinute >= resourceStart && endMinute <= resourceEnd;
}

function isBusy(resourceId: string, start: Date, end: Date, blocks: BusyBlock[]): boolean {
  return blocks.some(
    (block) =>
      block.resourceId === resourceId &&
      new Date(block.start).getTime() < end.getTime() &&
      new Date(block.end).getTime() > start.getTime(),
  );
}

export function calculateSlots(input: CalculationInput): Calculation {
  const resourceMap = new Map(input.resources.map((resource) => [resource.id, resource]));
  const relevantIds = [...new Set(input.service.requirements.flatMap((item) => item.resourceIds))].filter((id) => resourceMap.has(id));
  const slots: Slot[] = [];
  let baselineCount = 0;

  for (let dayOffset = 0; dayOffset < input.days; dayOffset += 1) {
    const date = addLocalDays(input.startDate, dayOffset);
    for (let minute = 0; minute + input.service.durationMinutes <= 24 * 60; minute += input.stepMinutes) {
      const endMinute = minute + input.service.durationMinutes;
      const startTime = `${String(Math.floor(minute / 60)).padStart(2, '0')}:${String(minute % 60).padStart(2, '0')}`;
      const endTime = `${String(Math.floor(endMinute / 60)).padStart(2, '0')}:${String(endMinute % 60).padStart(2, '0')}`;
      let start: Date;
      let end: Date;
      try {
        start = zonedDateTimeToDate(localDateTime(date, startTime), input.timezone);
        end = zonedDateTimeToDate(localDateTime(date, endTime), input.timezone);
      } catch {
        continue;
      }

      const workingIds = relevantIds.filter((id) => {
        const resource = resourceMap.get(id);
        return resource ? isWorking(resource, date, minute, endMinute) : false;
      });
      const availableIds = new Set(workingIds.filter((id) => !isBusy(id, start, end, input.busyBlocks)));
      const possible = allocations(input.service.requirements, availableIds);
      const result = maxDisjointCapacity(possible);
      if (result.capacity > 0) {
        slots.push({
          start: start.toISOString(),
          end: end.toISOString(),
          capacity: result.capacity,
          exampleResourceIds: result.example,
        });
      }

      const allLayersOpen = relevantIds.every(
        (id) => workingIds.includes(id) && !isBusy(id, start, end, input.busyBlocks),
      );
      if (allLayersOpen && possible.length > 0) baselineCount += 1;
    }
  }

  const offeredCount = slots.length;
  const recoveredCount = Math.max(0, offeredCount - baselineCount);
  const recoveryPercent = baselineCount > 0 ? (recoveredCount / baselineCount) * 100 : null;
  return { slots, baselineCount, offeredCount, recoveredCount, recoveryPercent };
}
