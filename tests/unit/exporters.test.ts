import { describe, expect, it, vi } from 'vitest';
import { calculationToCsv, calculationToIcs, jsonToState } from '../../src/exporters';
import type { Calculation, Service } from '../../src/types';

const service: Service = { id: 's', name: 'Room, consult', durationMinutes: 60, requirements: [] };
const calculation: Calculation = {
  slots: [{ start: '2026-08-28T09:00:00.000Z', end: '2026-08-28T10:00:00.000Z', capacity: 2, exampleResourceIds: [] }],
  baselineCount: 0,
  offeredCount: 1,
  recoveredCount: 1,
  recoveryPercent: null,
};

describe('availability export', () => {
  it('creates a quoted CSV with capacity', () => {
    const csv = calculationToCsv(calculation, service, 'UTC');
    expect(csv).toContain('"Room, consult"');
    expect(csv).toContain(',UTC,2');
  });

  it('creates advisory free-time ICS rather than booking events', () => {
    vi.stubGlobal('crypto', { randomUUID: () => 'test-id' });
    const ics = calculationToIcs(calculation, service);
    expect(ics).toContain('BEGIN:VFREEBUSY');
    expect(ics).toContain('FREEBUSY;FBTYPE=FREE:20260828T090000Z/20260828T100000Z');
    expect(ics).not.toContain('BEGIN:VEVENT');
  });

  it('rejects malformed backup data before it can reach the interface', () => {
    expect(() => jsonToState(JSON.stringify({ product: 'shared-capacity-slots', state: { version: 1, resources: [{ id: '\"><script>', name: 'bad' }] } }))).toThrow(/not a valid/);
  });
});
