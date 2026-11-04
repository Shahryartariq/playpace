import { expect, type Page } from '@playwright/test';

export const COURSE = 'https://www.youtube.com/playlist?list=PLplaypaceSampleCourse01';
export const MUSIC = 'https://www.youtube.com/playlist?list=PLplaypaceSampleMusic001';
export const LONG = 'https://www.youtube.com/playlist?list=PLplaypaceSampleLong0001';

/** Pastes links into the box and runs the calculation. */
export async function calculate(page: Page, links: string) {
  await page.getByLabel('YouTube links').fill(links);
  await page.getByRole('button', { name: 'Calculate length' }).click();
  await expect(page.locator('.summary')).toBeVisible();
}

/** Collects console errors and CSP violations so a test can assert there were none. */
export function watchConsole(page: Page): string[] {
  const problems: string[] = [];
  page.on('console', (msg) => {
    const text = msg.text();
    // Thumbnails of the fake sample videos don't exist on YouTube.
    if (msg.type() === 'error' && !/i\.ytimg\.com|Failed to load resource/.test(text)) problems.push(text);
  });
  page.on('pageerror', (err) => problems.push(err.message));
  return problems;
}
