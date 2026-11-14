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
    // The address carries the result, so refresh, Back and bookmarks reopen it.
    await expect(page).toHaveURL(/\/\?q=p%3APLplaypaceSampleCourse01$/);
    await expect(page.getByRole('link', { name: 'Share: WhatsApp' })).toHaveAttribute('href', /q%3Dp%253APLplaypaceSampleCourse01/);
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
    await expect(page.getByRole('link', { name: 'Share: WhatsApp' })).toHaveAttribute('href', /s%3D2/);

    await page.getByPlaceholder('Custom speed').fill('3.5');
    await expect(page.locator('.summary__label')).toHaveText('At 3.5×');
    await expect(page.locator('.speed-table tr.is-current th')).toHaveText('3.5×');
  });

  test('finds the slowest YouTube speed that fits the time you have', async ({ page }) => {
    await page.goto('/');
    await calculate(page, COURSE);
    const fit = page.getByRole('region', { name: 'How much time do you have?' });

    // 13h 36m 37s in 8 hours needs 1.70× → 1.75×, free on YouTube.
    await fit.getByLabel('Hours').fill('8');
    await expect(fit.locator('.time-fit__speed')).toHaveText('1.75×');
    await expect(fit.getByText('You’ll finish in 7h 46m 38s. 13m to spare.')).toBeVisible();
    await expect(fit.getByText(/YouTube Premium/)).toHaveCount(0);
    await fit.getByRole('button', { name: 'Use 1.75×' }).click();
    await expect(page.locator('.summary__label')).toHaveText('At 1.75×');
    await expect(page.locator('.summary__time')).toHaveText('7h 46m 38s');

    // 4 hours needs more than 2×, which takes Premium.
    await fit.getByLabel('Hours').fill('4');
    await expect(fit.locator('.time-fit__speed')).toHaveText('3.45×');
    await expect(fit.getByText('Speeds above 2× need YouTube Premium, which goes up to 4×.')).toBeVisible();

    // 3 hours is too little even at 4×.
    await fit.getByLabel('Hours').fill('3');
    await expect(fit.getByText('That’s not enough time. Even at 4×, the fastest YouTube allows, it takes 3h 24m 09s.')).toBeVisible();
    await expect(fit.locator('.time-fit__speed')).toHaveCount(0);

    // Enough time: normal speed.
    await fit.getByLabel('Hours').fill('14');
    await expect(fit.locator('.time-fit__speed')).toHaveText('1×');
    await expect(fit.getByText('Normal speed is enough. It takes 13h 36m 37s. 23m to spare.')).toBeVisible();
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
    await calculate(page, COURSE);
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
  await page.locator('.converter__form').getByLabel('Minutes', { exact: true }).fill('30');
  await page.locator('.converter__form .custom-speed input').fill('2');
  await expect(page.locator('.converter__time')).toHaveText('45m 00s');

  // 1h 30m in 1h 05m needs 1.385× → YouTube's next step up is 1.4×.
  const fit = page.getByRole('region', { name: 'How much time do you have?' });
  await fit.getByLabel('Hours').fill('1');
  await fit.getByLabel('Minutes').fill('5');
  await expect(fit.locator('.time-fit__speed')).toHaveText('1.4×');
  await expect(fit.getByText('You’ll finish in 1h 04m 17s.')).toBeVisible();
  await fit.getByRole('button', { name: 'Use 1.4×' }).click();
  await expect(page.locator('.converter__form .custom-speed input')).toHaveValue('1.4');
  await expect(fit.getByRole('button', { name: 'Use 1.4×' })).toHaveCount(0);
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

test('language links follow in-app navigation to the same page', async ({ page }) => {
  await page.goto('/');
  await page.locator('.site-header').getByRole('link', { name: 'Speed calculator' }).click();
  await expect(page).toHaveURL(/\/speed-calculator$/);
  await expect(page.locator('.site-footer__langs a[hreflang="es"]')).toHaveAttribute('href', '/es/speed-calculator');
  await expect(page.locator('.site-header .site-nav__link')).toHaveAttribute('aria-current', 'page');
});

test('the timeline has no per-block <title> tags and shows a hover label instead', async ({ page, isMobile }) => {
  test.skip(isMobile, 'Hover is a pointer feature.');
  await page.goto('/');
  await calculate(page, LONG);
  // Hundreds of SVG <title> tags make Malwarebytes Browser Guard block the page.
  await expect(page.locator('.timeline title')).toHaveCount(0);

  await page.goto('/');
  await calculate(page, COURSE);
  const svg = page.locator('.timeline__svg');
  await svg.hover({ position: { x: 3, y: 26 } });
  await expect(page.locator('.timeline__hover')).toContainText('1. Lesson 1: Setting up your tools');
  await expect(page.locator('.timeline__block.is-hover')).toHaveCount(1);
  await page.locator('.summary').hover();
  await expect(page.locator('.timeline__hover')).toHaveText('');
});

test('the links box centres its placeholder and the speed rows have room', async ({ page }) => {
  await page.goto('/');
  const box = page.getByLabel('YouTube links');
  const metrics = await box.evaluate((el) => {
    const cs = getComputedStyle(el);
    return {
      top: parseFloat(cs.paddingTop),
      bottom: parseFloat(cs.paddingBottom),
      height: el.getBoundingClientRect().height,
      line: parseFloat(cs.lineHeight),
      borders: parseFloat(cs.borderTopWidth) + parseFloat(cs.borderBottomWidth),
    };
  });
  // Empty box = one line plus equal padding, so the placeholder is vertically centred.
  expect(metrics.top).toBe(metrics.bottom);
  expect(Math.abs(metrics.height - (metrics.line + metrics.top + metrics.bottom + metrics.borders))).toBeLessThanOrEqual(2);

  await box.fill('https://www.youtube.com/playlist?list=PLplaypaceSampleCourse01\nhttps://www.youtube.com/playlist?list=PLplaypaceSampleMusic001');
  await expect.poll(async () => (await box.boundingBox())!.height).toBeGreaterThan(metrics.height + 10);

  const rowGap = await page.locator('.speed-chips').first().evaluate((el) => parseFloat(getComputedStyle(el).rowGap));
  expect(rowGap).toBeGreaterThanOrEqual(12);
});

test('nothing is wider than the screen, before or after results', async ({ page }) => {
  const overflow = () => page.evaluate(() => document.documentElement.scrollWidth - window.innerWidth);
  for (const path of ['/', '/speed-calculator', '/ur', '/privacy']) {
    await page.goto(path);
    expect(await overflow(), path).toBeLessThanOrEqual(0);
  }
  await page.goto('/');
  await calculate(page, COURSE);
  // Recent lookups have a long title; it must shorten, not stretch the form.
  await page.goto('/');
  await expect(page.locator('.recent__item').first()).toBeVisible();
  expect(await overflow()).toBeLessThanOrEqual(0);
});

test('typed numbers are dark and bold, not grey like the hint text', async ({ page }) => {
  await page.goto('/speed-calculator');
  const hours = page.locator('.converter__form').getByLabel('Hours', { exact: true });
  await expect(hours).toHaveValue('1');
  const style = await hours.evaluate((el) => {
    const cs = getComputedStyle(el);
    return { color: cs.color, weight: Number(cs.fontWeight), bg: cs.backgroundColor };
  });
  expect(style.color).toBe('rgb(18, 20, 43)');
  expect(style.weight).toBeGreaterThanOrEqual(600);
  expect(style.bg).toBe('rgb(255, 255, 255)');
});

test('the results page reads well on any screen', async ({ page, isMobile }) => {
  await page.goto('/');
  await calculate(page, COURSE);

  // The planner's deadline sits next to the start date, before the list of days.
  const deadline = page.locator('.planner').getByLabel('Or finish by');
  const firstDay = page.locator('.plan-day').first();
  expect((await deadline.boundingBox())!.y).toBeLessThan((await firstDay.boundingBox())!.y);

  // "How much time do you have?" sits with the speed table.
  await expect(page.locator('.results__col .time-fit')).toHaveCount(1);
  await expect(page.locator('.results__col .speed-table')).toHaveCount(1);

  const firstTitle = page.locator('.video-row__title').first();
  if (isMobile) {
    // Phones drop the thumbnail so a title gets most of the row.
    await expect(page.locator('.video-row__thumb').first()).toBeHidden();
    const row = (await page.locator('.video-row').first().boundingBox())!;
    expect((await firstTitle.boundingBox())!.width).toBeGreaterThan(row.width * 0.45);
  } else {
    // Desktop labels the columns, including when each video is done.
    await expect(page.locator('.video-rows__head')).toContainText('Done after');
  }
});

test.describe('flows found in the second audit', () => {
  test('a refresh keeps the result, with its range and speed', async ({ page }) => {
    await page.goto('/');
    await calculate(page, COURSE);
    await page.locator('.speed-chips').first().getByText('2×', { exact: true }).click();
    await expect(page).toHaveURL(/s=2/);
    await page.reload();
    await expect(page.locator('.summary__label')).toHaveText('At 2×');
    await expect(page.locator('.summary__scope')).toHaveText('Whole list, 33 videos');
  });

  test('switching language keeps the calculation', async ({ page }) => {
    await page.goto('/');
    await calculate(page, COURSE);
    await expect(page).toHaveURL(/q=/);
    await page.locator('.site-footer__langs a[hreflang="es"]').click();
    await expect(page).toHaveURL(/\/es\?q=p%3APLplaypaceSampleCourse01/);
    await expect(page.locator('.summary')).toBeVisible();
    await expect(page.locator('html')).toHaveAttribute('lang', 'es');
  });

  test('a start position from one link does not stick to the next one', async ({ page }) => {
    await page.goto('/');
    await calculate(page, `${COURSE}&index=5`);
    await expect(page.locator('.summary__scope')).toContainText('From video 5');
    await calculate(page, MUSIC);
    await expect(page.locator('.summary__scope')).toHaveText(/^Whole list/);
  });

  test('more than 10 links says only 10 are counted', async ({ page }) => {
    await page.goto('/');
    const links = Array.from({ length: 12 }, (_, i) => `https://youtu.be/abcdefghi${String(i).padStart(2, '0')}`).join('\n');
    await calculate(page, links);
    await expect(page.getByText('Only the first 10 links are counted.')).toBeVisible();
  });

  test('the speed page reads a video link, and sends playlists to the calculator', async ({ page }) => {
    await page.goto('/speed-calculator');
    const link = page.getByLabel('Paste a video link');
    await link.fill('https://youtu.be/abcdefghi01');
    await page.getByRole('button', { name: 'Get length' }).click();
    const form = page.locator('.converter__form');
    await expect(form.getByLabel('Hours', { exact: true })).toHaveValue('0');
    await expect(form.getByLabel('Minutes', { exact: true })).toHaveValue('20');
    await expect(form.getByLabel('Seconds', { exact: true })).toHaveValue('34');

    await link.fill('not a link');
    await page.getByRole('button', { name: 'Get length' }).click();
    await expect(page.locator('.converter__link').getByRole('alert')).toHaveText(/Couldn’t get that video’s length/);

    await link.fill(COURSE);
    await page.getByRole('button', { name: 'Get length' }).click();
    await expect(page).toHaveURL(/\/\?q=p%3APLplaypaceSampleCourse01&s=1\.5/);
    await expect(page.locator('.summary__label')).toHaveText('At 1.5×');
  });
});
