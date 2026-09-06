import { readFile } from 'node:fs/promises';
import { expect, test } from '@playwright/test';
import type { Page } from '@playwright/test';
import AxeBuilder from '@axe-core/playwright';

test.beforeEach(async ({ page }) => {
  await page.goto('/');
  await expect(page.getByRole('heading', { level: 1 })).toHaveText('Find service capacity across your team');
});

async function openDemo(page: Page): Promise<void> {
  await page.getByRole('link', { name: 'Try it with sample data' }).click();
  await expect(page).toHaveURL(/\?demo=1$/);
  await expect(page.getByText('Demo — sample data, nothing is saved')).toBeVisible();
  await expect(page.getByText('offerable starts', { exact: true })).toBeVisible();
}

test('@claim:sample-sandbox loads realistic results, resets, and leaves real data unchanged', async ({ page }) => {
  await page.getByLabel('Name').fill('Alex real plan');
  await page.getByRole('button', { name: 'Add resource' }).click();
  await expect(page.getByText('Alex real plan', { exact: true })).toBeVisible();

  await openDemo(page);
  await page.getByRole('tab', { name: /Resources/ }).click();
  await expect(page.getByText('Maya', { exact: true })).toBeVisible();
  page.once('dialog', (dialog) => dialog.accept());
  await page.getByRole('button', { name: 'Delete Maya' }).click();
  await expect(page.getByText('Maya', { exact: true })).toHaveCount(0);
  await page.getByRole('button', { name: 'Reset demo' }).click();
  await page.getByRole('tab', { name: /Resources/ }).click();
  await expect(page.getByText('Maya', { exact: true })).toBeVisible();

  await page.getByRole('link', { name: 'Start for real' }).click();
  await expect(page).toHaveURL(/\/$/);
  await expect(page.getByText('Alex real plan', { exact: true })).toBeVisible();
});

test('@claim:local-calendar-privacy keeps the complete demo flow on this origin', async ({ page }) => {
  const requests: string[] = [];
  page.on('request', (request) => requests.push(request.url()));
  await page.goto('/?demo=1');
  await expect(page.getByText('offerable starts', { exact: true })).toBeVisible();
  await page.getByRole('tab', { name: /Busy time/ }).click();
  await page.getByLabel('ICS calendar file').setInputFiles({
    name: 'maya.ics',
    mimeType: 'text/calendar',
    buffer: Buffer.from('BEGIN:VCALENDAR\nBEGIN:VEVENT\nUID:busy-private\nDTSTART:20260907T100000Z\nDTEND:20260907T110000Z\nSUMMARY:Private visit\nEND:VEVENT\nEND:VCALENDAR'),
  });
  await page.getByRole('button', { name: 'Import busy time' }).click();
  await expect(page.getByText('Private visit')).toBeVisible();

  expect(requests.length).toBeGreaterThan(0);
  expect(requests.every((url) => new URL(url).origin === 'http://127.0.0.1:4173')).toBe(true);
});

test('@claim:csv-export downloads one row for each calculated start', async ({ page }) => {
  await openDemo(page);
  const count = Number(await page.getByText('offerable starts', { exact: true }).locator('..').locator('strong').textContent());
  const downloadPromise = page.waitForEvent('download');
  await page.getByRole('button', { name: 'Export availability CSV' }).click();
  const download = await downloadPromise;
  const csv = await readFile((await download.path())!, 'utf8');
  const rows = csv.trim().split('\n');
  expect(rows[0]).toBe('Service,Start,End,Timezone,Parallel capacity');
  expect(rows).toHaveLength(count + 1);
});

test('@claim:advisory-ics-export downloads free time without creating bookings', async ({ page }) => {
  await openDemo(page);
  const downloadPromise = page.waitForEvent('download');
  await page.getByRole('button', { name: 'Export advisory ICS' }).click();
  const download = await downloadPromise;
  const ics = await readFile((await download.path())!, 'utf8');
  expect(ics).toContain('BEGIN:VFREEBUSY');
  expect(ics).toContain('FREEBUSY;FBTYPE=FREE:');
  expect(ics).not.toContain('BEGIN:VEVENT');
});

test('@claim:json-backup exports all sample resources and services', async ({ page }) => {
  await openDemo(page);
  await page.getByText('Your data and change history').click();
  const downloadPromise = page.waitForEvent('download');
  await page.getByRole('button', { name: 'Export backup' }).click();
  const download = await downloadPromise;
  const backup = JSON.parse(await readFile((await download.path())!, 'utf8')) as { state: { resources: unknown[]; services: unknown[] } };
  expect(backup.state.resources).toHaveLength(4);
  expect(backup.state.services).toHaveLength(2);
});

test('@claim:local-persistence keeps a real plan after reload', async ({ page }) => {
  await page.getByLabel('Name').fill('Alex');
  await page.getByRole('button', { name: 'Add resource' }).click();
  await expect(page.getByText('Alex', { exact: true })).toBeVisible();
  await page.reload();
  await expect(page.getByText('Alex', { exact: true })).toBeVisible();
});

test('@claim:paid-field-kit enables paid limits only after a valid verification response', async ({ page }) => {
  await page.route('https://api.sociobot.in/api/v1/products/shared-capacity-slots/verify?*', async (route) => {
    await route.fulfill({ status: 200, contentType: 'application/json', body: JSON.stringify({ valid: true, reason: 'ok', expires_at: null }) });
  });
  await page.getByLabel('Have a license?').fill('recorded-valid-license');
  await page.getByRole('button', { name: 'Restore' }).click();
  await expect(page.getByText('Field kit unlocked on this device.')).toBeVisible();
  const resources = ['A', 'B', 'C', 'D'].map((name) => ({ id: name, name, kind: 'person', workingHours: { weekdays: [1, 2, 3, 4, 5], start: '09:00', end: '17:00' } }));
  const services = ['One', 'Two', 'Three'].map((name) => ({ id: name, name, durationMinutes: 60, requirements: [{ id: `${name}-req`, label: 'person', quantity: 1, resourceIds: ['A'] }] }));
  await page.getByText('Your data and change history').click();
  page.once('dialog', (dialog) => dialog.accept());
  await page.locator('#import-json').setInputFiles({
    name: 'paid-plan.json',
    mimeType: 'application/json',
    buffer: Buffer.from(JSON.stringify({ product: 'shared-capacity-slots', state: { version: 1, timezone: 'UTC', slotStepMinutes: 30, resources, services, busyBlocks: [], history: [] } })),
  });
  await expect(page.getByText('A', { exact: true })).toBeVisible();
  await page.getByLabel('Name').fill('E');
  await page.getByRole('button', { name: 'Add resource' }).click();
  await expect(page.getByText('E', { exact: true })).toBeVisible();
  await page.getByRole('tab', { name: /Services/ }).click();
  await page.getByLabel('Service name').fill('Four');
  await page.getByLabel('Requirement name').fill('person');
  await page.getByLabel(/A person/).check();
  await page.getByRole('button', { name: 'Add service' }).click();
  await expect(page.getByText('Four', { exact: true })).toBeVisible();
  await page.getByRole('tab', { name: /Results/ }).click();
  await expect(page.getByLabel('Planning horizon').locator('option[value="28"]')).toBeEnabled();
});

test('@claim:license-fail-closed keeps an unverified token locked when verification is unavailable', async ({ page }) => {
  await page.route('https://api.sociobot.in/**', (route) => route.abort('failed'));
  await page.getByLabel('Have a license?').fill('anything-unverified');
  await page.getByRole('button', { name: 'Restore' }).click();
  await expect(page.getByText(/Paid features stay locked/)).toBeVisible();

  await page.getByLabel('Name').fill('Alex');
  await page.getByRole('button', { name: 'Add resource' }).click();
  await page.getByRole('tab', { name: /Services/ }).click();
  await page.getByLabel('Service name').fill('Consultation');
  await page.getByLabel('Requirement name').fill('person');
  await page.getByLabel(/Alex person/).check();
  await page.getByRole('button', { name: 'Add service' }).click();
  await page.getByRole('tab', { name: /Results/ }).click();
  await expect(page.getByLabel('Planning horizon').locator('option[value="28"]')).toBeDisabled();
});

test('moves keyboard focus and the viewport to the planner with the skip link', async ({ page }) => {
  await page.keyboard.press('Tab');
  await expect(page.getByRole('link', { name: 'Skip to planner' })).toBeFocused();
  await page.keyboard.press('Enter');
  await expect(page.locator('#planner')).toBeFocused();
  await expect.poll(() => page.evaluate(() => window.scrollY)).toBeGreaterThan(400);
});

test('supports arrow-key navigation between planner steps', async ({ page }) => {
  await page.getByRole('link', { name: 'Start with my plan' }).click();
  const resources = page.getByRole('tab', { name: /Resources/ });
  await resources.focus();
  await page.keyboard.press('ArrowRight');
  await expect(page.getByRole('tab', { name: /Services/ })).toBeFocused();
  await expect(page.getByRole('tab', { name: /Services/ })).toHaveAttribute('aria-selected', 'true');
});

test('@claim:end-to-end-plan builds a plan, imports ICS, and calculates through the forms', async ({ page }) => {
  await page.getByLabel('Name').fill('Alex');
  await page.getByRole('button', { name: 'Add resource' }).click();
  await page.getByRole('tab', { name: /Services/ }).click();
  await page.getByLabel('Service name').fill('Planning call');
  await page.getByLabel('Requirement name').fill('host');
  await page.getByLabel(/Alex person/).check();
  await page.getByRole('button', { name: 'Add service' }).click();
  await page.getByRole('tab', { name: /Busy time/ }).click();
  await page.getByLabel('ICS calendar file').setInputFiles({
    name: 'alex.ics', mimeType: 'text/calendar',
    buffer: Buffer.from('BEGIN:VCALENDAR\nBEGIN:VEVENT\nUID:busy-1\nDTSTART:20260831T100000Z\nDTEND:20260831T110000Z\nSUMMARY:Existing appointment\nEND:VEVENT\nEND:VCALENDAR'),
  });
  await page.getByRole('button', { name: 'Import busy time' }).click();
  await expect(page.getByText('Existing appointment')).toBeVisible();
  await page.getByRole('tab', { name: /Results/ }).click();
  await page.getByLabel('Start date').fill('2026-08-31');
  await page.getByLabel('Timezone').fill('UTC');
  await page.getByRole('button', { name: 'Calculate real capacity' }).click();
  await expect(page.getByText('offerable starts', { exact: true })).toBeVisible();
});

test('has no serious or critical axe violations', async ({ page }) => {
  await openDemo(page);
  const results = await new AxeBuilder({ page }).disableRules(['landmark-unique']).analyze();
  const severe = results.violations.filter((violation) => ['serious', 'critical'].includes(violation.impact ?? ''));
  expect(severe).toEqual([]);
});

test('loads without browser errors or a false first-install update notice', async ({ page }) => {
  const failures: string[] = [];
  page.on('console', (message) => { if (message.type() === 'error') failures.push(message.text()); });
  page.on('pageerror', (error) => failures.push(error.message));
  await page.reload();
  await page.evaluate(() => navigator.serviceWorker.ready);
  await page.waitForTimeout(300);
  await expect(page.locator('#toast')).toBeHidden();
  await openDemo(page);
  expect(failures).toEqual([]);
});

test('@claim:offline-reload reloads the sample while offline after the first visit', async ({ browser }) => {
  const context = await browser.newContext();
  try {
    const page = await context.newPage();
    await page.goto('/?demo=1');
    await expect(page.getByText('offerable starts', { exact: true })).toBeVisible();
    await page.evaluate(() => navigator.serviceWorker.ready);
    await page.reload();
    await context.setOffline(true);
    await page.reload();
    await expect(page.getByText('Demo — sample data, nothing is saved')).toBeVisible();
    await expect(page.getByText('offerable starts', { exact: true })).toBeVisible();
    await expect(page.locator('#network-status')).toContainText('Offline');
  } finally {
    await context.close();
  }
});

test('shows the cached offline guide for an uncached navigation', async ({ browser }) => {
  const context = await browser.newContext();
  try {
    const page = await context.newPage();
    await page.goto('/');
    await page.evaluate(() => navigator.serviceWorker.ready);
    await page.reload();
    await context.setOffline(true);
    await page.goto('/not-cached-offline-route');
    await expect(page.getByRole('heading', { level: 1 })).toHaveText('This page is not cached');
    await expect(page.getByRole('link', { name: 'Open the planner' })).toBeVisible();
  } finally {
    await context.close();
  }
});
