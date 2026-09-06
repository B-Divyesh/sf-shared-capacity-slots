import { expect, test } from '@playwright/test';
import AxeBuilder from '@axe-core/playwright';

test.beforeEach(async ({ page }) => {
  await page.goto('/');
  await expect(page.getByRole('heading', { level: 1 })).toHaveText('Find service capacity across your team');
});

test('shows the job, audience, action, and populated demo on a phone', async ({ page }) => {
  await expect(page.getByText(/For small service teams/)).toBeVisible();
  await expect(page.getByRole('link', { name: 'Try it with sample data' })).toBeVisible();
  await page.getByRole('link', { name: 'Try it with sample data' }).click();
  await expect(page).toHaveTitle('Demo — Shared Capacity Slots');
  await expect(page.getByText('Demo — sample data, nothing is saved')).toBeVisible();
  await expect(page.getByText('offerable starts', { exact: true })).toBeVisible();
  await page.getByRole('button', { name: 'Reset demo' }).click();
  await expect(page.getByText('offerable starts', { exact: true })).toBeVisible();
});

test('fits 390px without overflow and keeps visible controls at least 44px', async ({ page }) => {
  await page.getByRole('link', { name: 'Try it with sample data' }).click();
  const result = await page.evaluate(() => {
    const undersized = [...document.querySelectorAll<HTMLElement>('button, a, input, select')]
      .filter((element) => {
        const rect = element.getBoundingClientRect();
        const style = getComputedStyle(element);
        return rect.width > 0 && rect.height > 0 && style.opacity !== '0' && style.visibility !== 'hidden' && (rect.width < 44 || rect.height < 44);
      })
      .map((element) => element.textContent?.trim() || element.getAttribute('aria-label') || element.tagName);
    return { width: document.documentElement.scrollWidth, viewport: window.innerWidth, undersized };
  });
  expect(result.width).toBeLessThanOrEqual(result.viewport);
  expect(result.undersized).toEqual([]);
});

test('supports the keyboard skip link and reduced motion on a phone viewport', async ({ page }) => {
  await page.emulateMedia({ reducedMotion: 'reduce' });
  await page.keyboard.press('Tab');
  await expect(page.getByRole('link', { name: 'Skip to planner' })).toBeFocused();
  await page.keyboard.press('Enter');
  await expect(page.locator('#planner')).toBeFocused();
  const motion = await page.evaluate(() => ({
    media: matchMedia('(prefers-reduced-motion: reduce)').matches,
    scroll: getComputedStyle(document.documentElement).scrollBehavior,
    duration: getComputedStyle(document.querySelector('.step-panel')!).animationDuration,
  }));
  expect(motion.media).toBe(true);
  expect(motion.scroll).toBe('auto');
  expect(Number.parseFloat(motion.duration)).toBeLessThan(0.001);
});

test('has no serious or critical axe violations in the populated phone view', async ({ page }) => {
  await page.getByRole('link', { name: 'Try it with sample data' }).click();
  const results = await new AxeBuilder({ page }).disableRules(['landmark-unique']).analyze();
  expect(results.violations.filter((violation) => ['serious', 'critical'].includes(violation.impact ?? ''))).toEqual([]);
});
