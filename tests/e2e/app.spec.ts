import { expect, test } from '@playwright/test';
import AxeBuilder from '@axe-core/playwright';

test.beforeEach(async ({ page }) => {
  await page.goto('/');
  await expect(page.getByRole('heading', { level: 1 })).toHaveText('See the openings a shared calendar hides.');
});

test('loads the example and calculates conflict-safe capacity', async ({ page }) => {
  await page.getByRole('button', { name: 'Try the four-resource example' }).click();
  await expect(page.getByRole('tab', { name: /Results/ })).toHaveAttribute('aria-selected', 'true');
  await page.getByRole('button', { name: 'Calculate real capacity' }).click();
  await expect(page.getByText('offerable starts', { exact: true })).toBeVisible();
  await expect(page.getByRole('button', { name: 'Export availability CSV' })).toBeVisible();
  await expect(page.getByText('Advisory only.')).toBeVisible();
});

test('supports arrow-key navigation between planner steps', async ({ page }) => {
  await page.getByRole('link', { name: 'Map my capacity' }).click();
  const resources = page.getByRole('tab', { name: /Resources/ });
  await resources.focus();
  await page.keyboard.press('ArrowRight');
  await expect(page.getByRole('tab', { name: /Services/ })).toBeFocused();
  await expect(page.getByRole('tab', { name: /Services/ })).toHaveAttribute('aria-selected', 'true');
});

test('builds a plan, imports ICS, and calculates through the forms', async ({ page }) => {
  test.skip(test.info().project.name !== 'chromium', 'covered once as a longer workflow');
  await page.getByLabel('Name').fill('Alex');
  await page.getByRole('button', { name: 'Add resource' }).click();
  await expect(page.getByText('Alex', { exact: true })).toBeVisible();

  await page.getByRole('tab', { name: /Services/ }).click();
  await page.getByLabel('Service name').fill('Planning call');
  await page.getByLabel('Layer name').fill('host');
  await page.getByLabel(/Alex person/).check();
  await page.getByRole('button', { name: 'Add service' }).click();
  await expect(page.getByText('Planning call', { exact: true })).toBeVisible();

  await page.getByRole('tab', { name: /Busy time/ }).click();
  await page.getByLabel('ICS calendar file').setInputFiles({
    name: 'alex.ics',
    mimeType: 'text/calendar',
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
  await page.getByRole('button', { name: 'Try the four-resource example' }).click();
  await page.getByRole('button', { name: 'Calculate real capacity' }).click();
  const results = await new AxeBuilder({ page }).disableRules(['landmark-unique']).analyze();
  const severe = results.violations.filter((violation) => ['serious', 'critical'].includes(violation.impact ?? ''));
  expect(severe).toEqual([]);
});

test('loads without browser errors', async ({ page }) => {
  const failures: string[] = [];
  page.on('console', (message) => {
    if (message.type() === 'error') failures.push(message.text());
  });
  page.on('pageerror', (error) => failures.push(error.message));
  await page.reload();
  await page.getByRole('button', { name: 'Try the four-resource example' }).click();
  await page.getByRole('button', { name: 'Calculate real capacity' }).click();
  expect(failures).toEqual([]);
});

test('fits a 390px-class mobile viewport without horizontal page overflow', async ({ page }, testInfo) => {
  test.skip(testInfo.project.name !== 'mobile', 'mobile project only');
  const widths = await page.evaluate(() => ({ document: document.documentElement.scrollWidth, viewport: window.innerWidth }));
  expect(widths.document).toBeLessThanOrEqual(widths.viewport);
});

test('reloads while offline after the app shell is installed', async ({ page, context }) => {
  test.skip(test.info().project.name !== 'chromium', 'desktop project only');
  await page.evaluate(() => navigator.serviceWorker.ready);
  await page.reload();
  await expect(page.getByRole('heading', { level: 1 })).toBeVisible();
  await context.setOffline(true);
  await page.reload();
  await expect(page.getByRole('heading', { level: 1 })).toHaveText('See the openings a shared calendar hides.');
  await expect(page.locator('#network-status')).toContainText('Offline');
});

test('shows the cached offline guide for an uncached navigation', async ({ page, context }) => {
  test.skip(test.info().project.name !== 'chromium', 'desktop project only');
  await page.evaluate(() => navigator.serviceWorker.ready);
  await page.reload();
  await context.setOffline(true);
  await page.goto('/not-cached-offline-route');
  await expect(page.getByRole('heading', { level: 1 })).toHaveText('The field board is still on this device.');
  await expect(page.getByRole('link', { name: 'Open the planner' })).toBeVisible();
});
