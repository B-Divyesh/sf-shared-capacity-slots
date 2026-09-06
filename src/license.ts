const SLUG = 'shared-capacity-slots';
const API_BASE = 'https://api.sociobot.in/api/v1';
const LICENSE_KEY = `sb_license:${SLUG}`;
const VERDICT_KEY = `sb_license_verdict:${SLUG}`;
const DAY = 86_400_000;

interface Verdict {
  license: string;
  valid: boolean;
  checkedAt: number;
}

export interface LicenseState {
  unlocked: boolean;
  notice?: string;
}

export const checkoutUrl = `${API_BASE}/products/${SLUG}/checkout`;

export function captureLicenseFromUrl(): void {
  const url = new URL(window.location.href);
  const license = url.searchParams.get('license');
  if (!license) return;
  localStorage.setItem(LICENSE_KEY, license);
  localStorage.removeItem(VERDICT_KEY);
  url.searchParams.delete('license');
  history.replaceState(null, '', `${url.pathname}${url.search}${url.hash}`);
}

export function storeLicense(license: string): void {
  const value = license.trim();
  if (!value) throw new Error('Paste the license token from your purchase email.');
  localStorage.setItem(LICENSE_KEY, value);
  localStorage.removeItem(VERDICT_KEY);
}

function cachedVerdict(): Verdict | null {
  try {
    const value = JSON.parse(localStorage.getItem(VERDICT_KEY) ?? 'null') as Partial<Verdict> | null;
    if (!value || typeof value.license !== 'string' || typeof value.valid !== 'boolean' || typeof value.checkedAt !== 'number') return null;
    return value as Verdict;
  } catch {
    return null;
  }
}

export function optimisticLicenseState(): LicenseState {
  const license = localStorage.getItem(LICENSE_KEY);
  const verdict = cachedVerdict();
  return { unlocked: Boolean(license && verdict?.license === license && verdict.valid) };
}

export async function verifyLicense(force = false): Promise<LicenseState> {
  const token = localStorage.getItem(LICENSE_KEY);
  if (!token) return { unlocked: false };
  const verdict = cachedVerdict();
  if (!force && verdict?.license === token && Date.now() - verdict.checkedAt < DAY) return { unlocked: verdict.valid };
  try {
    const response = await fetch(`${API_BASE}/products/${SLUG}/verify?license=${encodeURIComponent(token)}`);
    if (!response.ok) throw new Error(response.status === 429 ? 'rate-limited' : 'unavailable');
    const result = (await response.json()) as { valid: boolean };
    if (typeof result.valid !== 'boolean') throw new Error('unavailable');
    localStorage.setItem(VERDICT_KEY, JSON.stringify({ license: token, valid: result.valid, checkedAt: Date.now() }));
    return {
      unlocked: result.valid,
      notice: result.valid ? undefined : 'License no longer active. The free planner is still available.',
    };
  } catch (error) {
    const unlocked = optimisticLicenseState().unlocked;
    const rateLimited = error instanceof Error && error.message === 'rate-limited';
    return {
      unlocked,
      notice: unlocked
        ? 'License check will retry later. A previous verified result remains active.'
        : rateLimited
          ? 'Too many license checks. Paid features stay locked; try again later.'
          : 'Could not verify this license. Paid features stay locked until a check succeeds.',
    };
  }
}
