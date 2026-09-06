import { describe, expect, it } from 'vitest';
import { calculateSlots } from '../../src/engine';
import type { BusyBlock, Resource, Service } from '../../src/types';

const resources: Resource[] = [
  { id: 'maya', name: 'Maya', kind: 'person', workingHours: { weekdays: [1], start: '09:00', end: '17:00' } },
  { id: 'leo', name: 'Leo', kind: 'person', workingHours: { weekdays: [1], start: '09:00', end: '17:00' } },
  { id: 'room', name: 'Room', kind: 'room', workingHours: { weekdays: [1], start: '09:00', end: '17:00' } },
];

const service: Service = {
  id: 'consult',
  name: 'Consultation',
  durationMinutes: 60,
  requirements: [
    { id: 'person-req', label: 'practitioner', quantity: 1, resourceIds: ['maya', 'leo'] },
    { id: 'room-req', label: 'room', quantity: 1, resourceIds: ['room'] },
  ],
};

const busy: BusyBlock[] = [
  { id: 'a', resourceId: 'maya', summary: 'Client', start: '2026-08-31T09:00:00.000Z', end: '2026-08-31T12:00:00.000Z', source: 'test' },
  { id: 'b', resourceId: 'leo', summary: 'Training', start: '2026-08-31T12:00:00.000Z', end: '2026-08-31T15:00:00.000Z', source: 'test' },
];

describe('capacity engine', () => {
  it('@claim:shared-calendar-comparison recovers valid alternatives that one shared busy calendar would hide', () => {
    const result = calculateSlots({ resources, service, busyBlocks: busy, timezone: 'UTC', startDate: '2026-08-31', days: 1, stepMinutes: 60 });
    expect(result.offeredCount).toBe(8);
    expect(result.baselineCount).toBe(2);
    expect(result.recoveredCount).toBe(6);
    expect(result.recoveryPercent).toBe(300);
  });

  it('reports parallel capacity when two independent paths are available', () => {
    const peopleOnly: Service = { ...service, requirements: [service.requirements[0]] };
    const result = calculateSlots({ resources, service: peopleOnly, busyBlocks: [], timezone: 'UTC', startDate: '2026-08-31', days: 1, stepMinutes: 60 });
    expect(result.slots[0].capacity).toBe(2);
  });

  it('never assigns the same resource to two requirements', () => {
    const impossible: Service = {
      ...service,
      requirements: [
        { id: 'one', label: 'operator', quantity: 1, resourceIds: ['maya'] },
        { id: 'two', label: 'assistant', quantity: 1, resourceIds: ['maya'] },
      ],
    };
    const result = calculateSlots({ resources, service: impossible, busyBlocks: [], timezone: 'UTC', startDate: '2026-08-31', days: 1, stepMinutes: 60 });
    expect(result.slots).toHaveLength(0);
  });

  it('does not offer slots that overlap a busy interval boundary', () => {
    const peopleOnly: Service = { ...service, requirements: [service.requirements[0]] };
    const bothBusy: BusyBlock[] = [
      { ...busy[0], resourceId: 'maya', start: '2026-08-31T09:30:00.000Z', end: '2026-08-31T10:30:00.000Z' },
      { ...busy[1], resourceId: 'leo', start: '2026-08-31T09:30:00.000Z', end: '2026-08-31T10:30:00.000Z' },
    ];
    const result = calculateSlots({ resources, service: peopleOnly, busyBlocks: bothBusy, timezone: 'UTC', startDate: '2026-08-31', days: 1, stepMinutes: 30 });
    expect(result.slots.some((slot) => slot.start === '2026-08-31T09:00:00.000Z')).toBe(false);
    expect(result.slots.some((slot) => slot.start === '2026-08-31T10:30:00.000Z')).toBe(true);
  });

  it('@claim:conflict-free-slots returns only starts with a complete, non-overlapping allocation', () => {
    const result = calculateSlots({ resources, service, busyBlocks: busy, timezone: 'UTC', startDate: '2026-08-31', days: 1, stepMinutes: 30 });
    expect(result.slots.length).toBeGreaterThan(0);
    for (const slot of result.slots) {
      const start = new Date(slot.start).getTime();
      const end = new Date(slot.end).getTime();
      expect(new Set(slot.exampleResourceIds).size).toBe(2);
      expect(slot.exampleResourceIds).toContain('room');
      expect(slot.exampleResourceIds.some((id) => id === 'maya' || id === 'leo')).toBe(true);
      expect(busy.some((block) => slot.exampleResourceIds.includes(block.resourceId) && start < new Date(block.end).getTime() && end > new Date(block.start).getTime())).toBe(false);
    }
  });
});
