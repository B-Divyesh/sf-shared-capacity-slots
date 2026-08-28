import type { AppState } from './types';

const DB_NAME = 'shared-capacity-slots';
const STORE_NAME = 'planner';
const STATE_KEY = 'current';

export function emptyState(): AppState {
  return {
    version: 1,
    resources: [],
    services: [],
    busyBlocks: [],
    timezone: Intl.DateTimeFormat().resolvedOptions().timeZone || 'UTC',
    slotStepMinutes: 30,
    history: [],
  };
}

function openDatabase(): Promise<IDBDatabase> {
  return new Promise((resolve, reject) => {
    const request = indexedDB.open(DB_NAME, 1);
    request.onupgradeneeded = () => {
      if (!request.result.objectStoreNames.contains(STORE_NAME)) {
        request.result.createObjectStore(STORE_NAME);
      }
    };
    request.onsuccess = () => resolve(request.result);
    request.onerror = () => reject(request.error ?? new Error('Could not open local storage.'));
  });
}

export async function loadState(): Promise<AppState> {
  const db = await openDatabase();
  return new Promise((resolve, reject) => {
    const tx = db.transaction(STORE_NAME, 'readonly');
    const request = tx.objectStore(STORE_NAME).get(STATE_KEY);
    request.onsuccess = () => resolve((request.result as AppState | undefined) ?? emptyState());
    request.onerror = () => reject(request.error ?? new Error('Could not read local plan.'));
    tx.oncomplete = () => db.close();
  });
}

export async function saveState(state: AppState): Promise<void> {
  const db = await openDatabase();
  return new Promise((resolve, reject) => {
    const tx = db.transaction(STORE_NAME, 'readwrite');
    tx.objectStore(STORE_NAME).put(state, STATE_KEY);
    tx.oncomplete = () => {
      db.close();
      resolve();
    };
    tx.onerror = () => reject(tx.error ?? new Error('Could not save the local plan.'));
  });
}

export async function clearState(): Promise<void> {
  const db = await openDatabase();
  return new Promise((resolve, reject) => {
    const tx = db.transaction(STORE_NAME, 'readwrite');
    tx.objectStore(STORE_NAME).delete(STATE_KEY);
    tx.oncomplete = () => {
      db.close();
      resolve();
    };
    tx.onerror = () => reject(tx.error ?? new Error('Could not clear the local plan.'));
  });
}
