const SLUG = 'shared-capacity-slots';
const API_BASE = 'https://api.sociobot.in/api/v1';
const LICENSE_KEY = `sb_license:${SLUG}`;
const VERDICT_KEY = `sb_license_verdict:${SLUG}`;
const DAY = 86_400_000;

interface Verdict {
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
  localStorage.setItem(VERDICT_KEY, JSON.stringify({ valid: true, checkedAt: 0 }));
  url.searchParams.delete('license');
  history.replaceState(null, '', `${url.pathname}${url.search}${url.hash}`);
}

export function storeLicense(license: string): void {
  const value = license.trim();
  if (!value) throw new Error('Paste the license token from your purchase email.');
  localStorage.setItem(LICENSE_KEY, value);
  localStorage.setItem(VERDICT_KEY, JSON.stringify({ valid: true, checkedAt: 0 }));
}

function cachedVerdict(): Verdict | null {
  try {
    return JSON.parse(localStorage.getItem(VERDICT_KEY) ?? 'null') as Verdict | null;
  } catch {
    return null;
  }
}

export function optimisticLicenseState(): LicenseState {
  const hasLicense = Boolean(localStorage.getItem(LICENSE_KEY));
  const verdict = cachedVerdict();
  return { unlocked: hasLicense && verdict?.valid !== false };
}

export async function verifyLicense(force = false): Promise<LicenseState> {
  const token = localStorage.getItem(LICENSE_KEY);
  if (!token) return { unlocked: false };
  const verdict = cachedVerdict();
  if (!force && verdict && Date.now() - verdict.checkedAt < DAY) return { unlocked: verdict.valid };
  try {
    const response = await fetch(`${API_BASE}/products/${SLUG}/verify?license=${encodeURIComponent(token)}`);
    if (!response.ok) throw new Error('Verification service unavailable');
    const result = (await response.json()) as { valid: boolean };
    localStorage.setItem(VERDICT_KEY, JSON.stringify({ valid: result.valid, checkedAt: Date.now() }));
    return {
      unlocked: result.valid,
      notice: result.valid ? undefined : 'License no longer active. The free planner is still available.',
    };
  } catch {
    return { unlocked: optimisticLicenseState().unlocked, notice: 'License check will retry when you are online.' };
  }
}
