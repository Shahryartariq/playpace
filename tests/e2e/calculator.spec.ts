import { readFile } from 'node:fs/promises';
import { expect, test } from '@playwright/test';
import { calculate, COURSE, LONG, MUSIC, watchConsole } from './helpers';

test.describe('calculator', () => {
  test('adds up a playlist and leaves out private, deleted and live videos', async ({ page }) => {
    const problems = watchConsole(page);
    await page.goto('/');
    await calculate(page, COURSE);

    await expect(page.locator('.summary__time')).toHaveText('13h 36m 37s');
    await expect(page.locator('.summary__scope')).toHaveText('Whole list, 33 videos');
    await expect(page.getByText('2 private or deleted videos not counted')).toBeVisible();
    await expect(page.getByText('1 live stream or premiere not counted')).toBeVisible();
    await expect(page.locator('.list-card__title')).toHaveText('Full-stack web development, complete course');
    await expect(page.locator('.video-row')).toHaveCount(36);
    await expect(page).toHaveURL(/\?q=p%3APLplaypaceSampleCourse01$/);
    expect(problems).toEqual([]);
  });

  test('shows the time at a faster speed and how much it saves', async ({ page }) => {
    await page.goto('/');
    await calculate(page, COURSE);
    await page.locator('.speed-chips').first().getByText('2×', { exact: true }).click();

    await expect(page.locator('.summary__label')).toHaveText('At 2×');
    await expect(page.locator('.summary__time')).toHaveText('6h 48m 19s');
    await expect(page.locator('.summary__sub .saved')).toHaveText('saves 6h 48m 19s');
    await expect(page.locator('.timeline__saved')).toBeVisible();
    await expect(page).toHaveURL(/s=2$/);

    await page.getByPlaceholder('Custom speed').fill('3.5');
    await expect(page.locator('.summary__label')).toHaveText('At 3.5×');
    await expect(page.locator('.speed-table tr.is-current th')).toHaveText('3.5×');
  });

  test('counts a range and the rest of a list from a video', async ({ page }) => {
    await page.goto('/');
    await calculate(page, COURSE);

    await page.getByText('Range', { exact: true }).click();
    await page.getByLabel('From video').fill('2');
    await page.getByLabel('To video').fill('4');
    await expect(page.locator('.summary__scope')).toHaveText('Videos 2 to 4, 3 videos');

    await page.locator('.video-row').nth(9).getByRole('button', { name: 'Start here' }).click();
    await expect(page.locator('.summary__scope')).toHaveText('From video 10 to the end, 25 videos');
    await expect(page.locator('.video-row').first()).toHaveClass(/is-outside/);
  });

  test('starts from the video in a link copied while watching', async ({ page }) => {
    await page.goto('/');
    await calculate(page, `https://www.youtube.com/watch?v=abcdefghijk&list=PLplaypaceSampleCourse01&index=30`);
    await expect(page.getByText('Your link points to video 30, so counting starts there.')).toBeVisible();
    await expect(page.locator('.summary__scope')).toHaveText('From video 30 to the end, 6 videos');
  });

  test('adds several lists together', async ({ page }) => {
    await page.goto('/');
    await calculate(page, `${COURSE}\n${MUSIC}`);
    await expect(page.getByText('2 lists added together')).toBeVisible();
    await expect(page.locator('.list-card')).toHaveCount(2);
    await expect(page.locator('.video-row')).toHaveCount(54);
  });

  test('reads a 1,200-video list and pages through the videos', async ({ page }) => {
    await page.goto('/');
    await calculate(page, LONG);
    await expect(page.locator('.summary__scope')).toHaveText('Whole list, 1,200 videos');
    await expect(page.locator('.video-row')).toHaveCount(100);
    await page.getByRole('button', { name: 'Show 100 more' }).click();
    await expect(page.locator('.video-row')).toHaveCount(200);
    await page.getByPlaceholder('Search titles').fill('Lesson 1199:');
    await expect(page.locator('.video-row')).toHaveCount(1);
  });

  test('remembers watched videos and takes them out of the time left', async ({ page }) => {
    await page.goto('/');
    await calculate(page, COURSE);
    await page.getByLabel('Mark “Lesson 1: Setting up your tools” as watched').check();
    await expect(page.locator('.summary__time')).not.toHaveText('13h 36m 37s');
    await expect(page.locator('.summary__scope')).toHaveText('Whole list, 32 videos');
    await expect(page.locator('.watched-progress')).toContainText('1 watched');

    await page.reload();
    await expect(page.locator('.summary')).toBeVisible();
    await expect(page.locator('.summary__scope')).toHaveText('Whole list, 32 videos');
    await page.getByRole('button', { name: 'Clear watched' }).click();
    await expect(page.locator('.summary__time')).toHaveText('13h 36m 37s');
  });

  test('reopens a shared link with the same range and speed', async ({ page }) => {
    await page.goto('/?q=p%3APLplaypaceSampleCourse01&m=range&a=3&b=20&s=1.5');
    await expect(page.locator('.summary')).toBeVisible();
    await expect(page.locator('.summary__label')).toHaveText('At 1.5×');
    await expect(page.locator('.summary__scope')).toHaveText('Videos 3 to 20, 16 videos');
    await expect(page.getByLabel('YouTube links')).toHaveValue(COURSE);
  });

  test('plans the days and exports the plan and the list', async ({ page }) => {
    await page.goto('/');
    await calculate(page, COURSE);
    await expect(page.locator('.planner__answer').first()).toContainText('That’s 18 days.');
    await page.locator('.planner').getByText('2h', { exact: true }).click();
    await expect(page.locator('.planner__answer').first()).toContainText('That’s 8 days.');

    const [ics] = await Promise.all([page.waitForEvent('download'), page.getByRole('button', { name: 'Add plan to calendar' }).click()]);
    expect(ics.suggestedFilename()).toBe('full-stack-web-development-complete-course-plan.ics');
    const icsText = await readFile((await ics.path())!, 'utf8');
    expect(icsText.match(/BEGIN:VEVENT/g)).toHaveLength(8);

    const [csv] = await Promise.all([page.waitForEvent('download'), page.getByRole('button', { name: 'Download CSV' }).click()]);
    const csvText = await readFile((await csv.path())!, 'utf8');
    expect(csvText.split('\r\n').filter(Boolean)).toHaveLength(37);
    expect(csvText).toContain('Lesson 1: Setting up your tools');
  });

  test('offers share links that reopen the result', async ({ page }) => {
    await page.goto('/');
    await calculate(page, COURSE);
    const whatsapp = page.getByRole('link', { name: 'Share: WhatsApp' });
    await expect(whatsapp).toHaveAttribute('href', /wa\.me\/\?text=.*q%3Dp%253APLplaypaceSampleCourse01/);
    await expect(page.getByRole('link', { name: 'Share: X' })).toHaveAttribute('href', /^https:\/\/x\.com\/intent\/post/);
  });

  test('keeps recent lookups and reruns them', async ({ page }) => {
    await page.goto('/');
    await calculate(page, MUSIC);
    await page.goto('/');
    await page.locator('.recent__item').first().click();
    await expect(page.locator('.list-card__title')).toHaveText('Focus music mix');
  });

  test.describe('explains problems', () => {
    for (const [input, message] of [
      ['', 'Paste a YouTube playlist, video or channel link first.'],
      ['hello', 'That doesn’t look like a YouTube link.'],
      ['https://www.youtube.com/watch?v=abcdefghijk&list=RDabcdefghijk', 'Mixes (lists that start with “RD”)'],
      ['https://www.youtube.com/playlist?list=WL', 'Watch later, Liked videos and Your mix are private'],
      ['https://www.youtube.com/playlist?list=PLplaypaceNotFound00001', 'YouTube says this list doesn’t exist or is private.'],
      ['https://www.youtube.com/playlist?list=PLplaypaceQuota00000001', 'today’s YouTube data allowance'],
    ] as const) {
      test(`for "${input || 'nothing'}"`, async ({ page }) => {
        await page.goto('/');
        await page.getByLabel('YouTube links').fill(input);
        await page.getByRole('button', { name: 'Calculate length' }).click();
        await expect(page.locator('.alert--error')).toContainText(message);
      });
    }
  });
});

test('the speed calculator converts a length at every speed', async ({ page }) => {
  await page.goto('/speed-calculator');
  await expect(page.locator('.converter__time')).toHaveText('40m 00s');
  await page.getByLabel('Minutes', { exact: true }).fill('30');
  await page.locator('.converter__form .custom-speed input').fill('2');
  await expect(page.locator('.converter__time')).toHaveText('45m 00s');
  await page.getByLabel('Time I have (minutes)').fill('60');
  await expect(page.getByText('Watch at 1.5× or faster.')).toBeVisible();
});

test('the theme toggle switches and remembers dark mode', async ({ page }) => {
  await page.goto('/');
  const html = page.locator('html');
  await page.getByRole('button', { name: /^Theme:/ }).click();
  await expect(html).toHaveAttribute('data-theme', 'light');
  await page.getByRole('button', { name: /^Theme:/ }).click();
  await expect(html).toHaveAttribute('data-theme', 'dark');
  await page.reload();
  await expect(html).toHaveAttribute('data-theme', 'dark');
});

test('Urdu is right to left and fully translated', async ({ page }) => {
  await page.goto('/ur');
  await expect(page.locator('html')).toHaveAttribute('dir', 'rtl');
  await expect(page.locator('html')).toHaveAttribute('lang', 'ur');
  await page.getByRole('textbox').first().fill(COURSE);
  await page.locator('.calc-form__submit button').click();
  await expect(page.locator('.summary')).toBeVisible();
  await expect(page.locator('.summary__time')).toContainText('گھنٹے');
});

test('language links follow in-app navigation to the same page', async ({ page, isMobile }) => {
  test.skip(isMobile, 'The speed calculator link is in the footer on small screens; covered on desktop.');
  await page.goto('/');
  await page.locator('.site-header').getByRole('link', { name: 'Speed calculator' }).click();
  await expect(page).toHaveURL(/\/speed-calculator$/);
  await expect(page.locator('.site-footer__langs a[hreflang="es"]')).toHaveAttribute('href', '/es/speed-calculator');
  await expect(page.locator('.site-header .site-nav__link')).toHaveAttribute('aria-current', 'page');
});
