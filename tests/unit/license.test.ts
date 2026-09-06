import { beforeEach, describe, expect, it, vi } from 'vitest';
import { optimisticLicenseState, storeLicense, verifyLicense } from '../../src/license';

class MemoryStorage implements Storage {
  private values = new Map<string, string>();
  get length(): number { return this.values.size; }
  clear(): void { this.values.clear(); }
  getItem(key: string): string | null { return this.values.get(key) ?? null; }
  key(index: number): string | null { return [...this.values.keys()][index] ?? null; }
  removeItem(key: string): void { this.values.delete(key); }
  setItem(key: string, value: string): void { this.values.set(key, String(value)); }
}

describe('license verification', () => {
  beforeEach(() => {
    vi.stubGlobal('localStorage', new MemoryStorage());
    vi.restoreAllMocks();
  });

  it('keeps a new token locked when verification is unavailable', async () => {
    storeLicense('anything-unverified');
    vi.stubGlobal('fetch', vi.fn().mockRejectedValue(new Error('offline')));

    expect(optimisticLicenseState()).toEqual({ unlocked: false });
    await expect(verifyLicense(true)).resolves.toMatchObject({
      unlocked: false,
      notice: expect.stringContaining('stay locked'),
    });
  });

  it('unlocks only after a valid response and binds the verdict to that token', async () => {
    storeLicense('paid-token');
    vi.stubGlobal('fetch', vi.fn().mockResolvedValue(new Response(JSON.stringify({ valid: true }), {
      status: 200,
      headers: { 'content-type': 'application/json' },
    })));

    await expect(verifyLicense(true)).resolves.toEqual({ unlocked: true });
    expect(optimisticLicenseState()).toEqual({ unlocked: true });

    localStorage.setItem('sb_license:shared-capacity-slots', 'different-token');
    expect(optimisticLicenseState()).toEqual({ unlocked: false });
  });

  it('keeps paid features locked after a rate-limited first check', async () => {
    storeLicense('new-token');
    vi.stubGlobal('fetch', vi.fn().mockResolvedValue(new Response('', { status: 429, headers: { 'retry-after': '60' } })));

    await expect(verifyLicense(true)).resolves.toMatchObject({
      unlocked: false,
      notice: expect.stringContaining('Too many license checks'),
    });
  });

  it('keeps a previously verified token available during an outage', async () => {
    storeLicense('paid-token');
    vi.stubGlobal('fetch', vi.fn().mockResolvedValueOnce(new Response(JSON.stringify({ valid: true }), { status: 200 })));
    await verifyLicense(true);
    vi.stubGlobal('fetch', vi.fn().mockRejectedValue(new Error('offline')));

    await expect(verifyLicense(true)).resolves.toMatchObject({ unlocked: true });
  });
});
