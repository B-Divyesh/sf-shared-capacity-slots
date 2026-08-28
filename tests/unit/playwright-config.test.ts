import { describe, expect, it } from 'vitest';
import playwrightConfig from '../../playwright.config';

describe('Playwright process stability', () => {
  it('starts browser contexts serially while retaining both browser profiles', () => {
    expect(playwrightConfig.fullyParallel).toBe(false);
    expect(playwrightConfig.workers).toBe(1);
    expect(playwrightConfig.projects?.map((project) => project.name)).toEqual([
      'chromium',
      'mobile',
    ]);
  });
});
