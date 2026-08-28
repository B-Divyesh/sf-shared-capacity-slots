export type ResourceKind = 'person' | 'room' | 'equipment' | 'other';

export interface WorkingHours {
  weekdays: number[];
  start: string;
  end: string;
}

export interface Resource {
  id: string;
  name: string;
  kind: ResourceKind;
  workingHours: WorkingHours;
}

export interface Requirement {
  id: string;
  label: string;
  resourceIds: string[];
  quantity: number;
}

export interface Service {
  id: string;
  name: string;
  durationMinutes: number;
  requirements: Requirement[];
}

export interface BusyBlock {
  id: string;
  resourceId: string;
  summary: string;
  start: string;
  end: string;
  source: string;
}

export interface HistoryEntry {
  id: string;
  at: string;
  message: string;
}

export interface AppState {
  version: 1;
  resources: Resource[];
  services: Service[];
  busyBlocks: BusyBlock[];
  timezone: string;
  slotStepMinutes: number;
  history: HistoryEntry[];
}

export interface Slot {
  start: string;
  end: string;
  capacity: number;
  exampleResourceIds: string[];
}

export interface Calculation {
  slots: Slot[];
  baselineCount: number;
  offeredCount: number;
  recoveredCount: number;
  recoveryPercent: number | null;
}
