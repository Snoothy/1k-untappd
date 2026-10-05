import { test, expect, type Page } from "@playwright/test";
import live from "../../src/data/live-config.json" with { type: "json" };

const site = "/1k-untappd/";
const liveUrl = live.progressUrl;

test.beforeEach(async ({ page }) => {
  await page.route(liveUrl, route => route.fulfill({status: 503, json: {error: "test fallback"}}));
});
const data = {
  username: "Snoothy",
  displayName: "Snoothy",
  current: 987,
  target: 1000,
  source: "scraped",
  updatedAt: "2026-10-05T17:00:00Z",
};

async function loaded(page: Page) {
  await page.goto(site);
  await expect(page.locator("[data-supernova]")).toHaveAttribute(
    "data-mounted",
    "true",
  );
  await expect(page.locator(".sn-controls")).toHaveCount(0);
}

test("renders real data on the server even with JavaScript disabled", async ({
  browser,
}) => {
  const context = await browser.newContext({
    javaScriptEnabled: false,
    baseURL: "http://127.0.0.1:4321",
  });
  const page = await context.newPage();
  const response = await page.request.get(`${site}progress.json`);
  const snapshot = await response.json();
  await page.goto(site);
  await expect(page.locator(".sn-count")).toHaveText(
    snapshot.current.toLocaleString("en-US"),
  );
  await expect(page.getByRole("heading", { level: 1 })).toBeVisible();
  await expect(page.locator(".sn-controls")).toHaveCount(0);
  await context.close();
});

test("plays the finale, restores the latest real count, and supports full screen", async ({
  page,
}) => {
  const errors: string[] = [];
  page.on("pageerror", (error) => errors.push(error.message));
  await loaded(page);
  const original = await page.locator(".sn-count").innerText();
  await page.keyboard.press("f");
  await expect
    .poll(() => page.evaluate(() => document.fullscreenElement?.id))
    .toBe("supernova");
  await page.keyboard.press("f");
  await expect
    .poll(() => page.evaluate(() => document.fullscreenElement === null))
    .toBe(true);
  await page.keyboard.press("s");
  await expect(page.locator(".sn-count")).toHaveText(original);
  await page.keyboard.press("Space");
  await expect(page.locator(".sn-demo")).toHaveText("FINALE PREVIEW");
  await expect(page.locator(".sn-count")).toHaveText("997");
  await expect(page.locator(".sn-count")).toHaveText("1,000", {
    timeout: 25_000,
  });
  await expect(page.getByRole("progressbar")).toHaveAttribute(
    "aria-valuenow",
    "1000",
  );
  await page.screenshot({
    path: "test-results/supernova-finale.png",
    fullPage: true,
  });
  await page.keyboard.press("Space");
  await expect(page.locator(".sn-count")).toHaveText(original);
  await page.screenshot({
    path: "test-results/supernova-desktop.png",
    fullPage: true,
  });
  expect(errors).toEqual([]);
});

test("refreshes immediately and every 30 seconds, restoring the latest real count after previews", async ({ page }) => {
  let response = { ...data, updatedAt: "2026-10-05T18:30:00Z" };
  let requests = 0;
  await page.unroute(liveUrl);
  await page.route(liveUrl, route => { requests++; return route.fulfill({ json: response }); });
  await page.emulateMedia({ reducedMotion: "reduce" });
  await page.clock.install({time: new Date("2026-10-05T18:30:00Z")});
  await loaded(page);
  await expect(page.locator(".sn-count")).toHaveText("987");
  await expect(page.locator(".sn-demo")).toHaveText("LIVE UPDATES");
  expect(requests).toBe(1);
  await page.keyboard.press("Space");
  await expect(page.locator(".sn-count")).toHaveText("1,000");
  response = { ...data, current: 992, updatedAt: "2026-10-05T18:30:30Z" };
  await page.clock.fastForward(30_100);
  await expect.poll(() => requests).toBe(2);
  await page.keyboard.press("Space");
  await expect(page.locator(".sn-count")).toHaveText("992");
  response = { ...data, current: 800, source: "fallback", updatedAt: "2026-10-05T18:31:00Z" };
  await page.clock.fastForward(30_100);
  await expect(page.locator(".sn-demo")).toHaveText("RECONNECTING");
  await expect(page.locator(".sn-count")).toHaveText("992");
  response = { ...data, current: 1043, updatedAt: "2026-10-05T18:32:00Z" };
  await page.clock.fastForward(60_100);
  await expect(page.locator(".sn-count")).toHaveText("1,043");
  await expect(page.locator(".sn-demo")).toHaveText("LIVE UPDATES");
  await expect(page.getByRole("progressbar")).toHaveAttribute("aria-valuenow", "1000");
  await page.clock.fastForward(20_000);
  await expect(page.locator(".sn-count")).toHaveText("1,043");
});

test("backs off after failures and pauses while offline or hidden", async ({ page, context }) => {
  let requests = 0;
  let fail = false;
  await page.unroute(liveUrl);
  await page.route(liveUrl, route => {
    requests++;
    return fail
      ? route.fulfill({status: 429, headers: {"Retry-After": "120"}, json: {error: "retry later"}})
      : route.fulfill({json: {...data, updatedAt: "2026-10-05T18:30:00Z"}});
  });
  await page.emulateMedia({reducedMotion: "reduce"});
  await page.clock.install({time: new Date("2026-10-05T18:30:00Z")});
  await loaded(page);
  await expect(page.locator(".sn-count")).toHaveText("987");
  fail = true;
  await page.clock.fastForward(30_100);
  await expect(page.locator(".sn-demo")).toHaveText("RECONNECTING");
  const afterFailure = requests;
  await page.clock.fastForward(60_000);
  expect(requests).toBe(afterFailure);
  await page.clock.fastForward(61_000);
  await expect.poll(() => requests).toBe(afterFailure + 1);
  await context.setOffline(true);
  await expect(page.locator(".sn-demo")).toHaveText("OFFLINE · LAST UPDATE");
  const beforeOffline = requests;
  await page.clock.fastForward(300_000);
  expect(requests).toBe(beforeOffline);
  await expect(page.locator(".sn-count")).toHaveText("987");
  fail = false;
  await page.unroute(liveUrl);
  await page.route(liveUrl, route => { requests++; return route.fulfill({json: {...data, current: 988, updatedAt: "2026-10-05T18:37:31Z"}}); });
  await context.setOffline(false);
  await expect(page.locator(".sn-count")).toHaveText("988");
  await page.evaluate(() => {
    Object.defineProperty(document, "hidden", {configurable: true, get: () => true});
    document.dispatchEvent(new Event("visibilitychange"));
  });
  const beforeHidden = requests;
  await page.clock.fastForward(90_000);
  expect(requests).toBe(beforeHidden);
  await page.evaluate(() => {
    Object.defineProperty(document, "hidden", {configurable: true, get: () => false});
    document.dispatchEvent(new Event("visibilitychange"));
  });
  await expect.poll(() => requests).toBe(beforeHidden + 1);
});

test("fits a mobile screen and honors reduced motion", async ({ page }) => {
  await page.setViewportSize({ width: 360, height: 800 });
  await page.emulateMedia({ reducedMotion: "reduce" });
  await loaded(page);
  await expect(page.locator("#supernova")).toHaveClass(/sn-paused/);
  await page.keyboard.press("p");
  await expect(page.locator("#supernova")).not.toHaveClass(/sn-paused/);
  await page.keyboard.press("p");
  await expect(page.locator("#supernova")).toHaveClass(/sn-paused/);
  await page.keyboard.press("Space");
  await expect(page.locator(".sn-count")).toHaveText("1,000");
  expect(
    await page.evaluate(
      () => document.documentElement.scrollWidth <= window.innerWidth,
    ),
  ).toBe(true);
  await page.screenshot({
    path: "test-results/supernova-mobile.png",
    fullPage: true,
  });
});

test("the public progress API is readable from the GitHub Pages origin", async ({ page }) => {
  await page.unroute(liveUrl);
  await page.goto("https://snoothy.github.io/1k-untappd/");
  const result = await page.evaluate(async url => {
    const response = await fetch(url, {cache: "no-store", credentials: "omit", signal: AbortSignal.timeout(10_000)});
    return {status: response.status, data: await response.json()};
  }, liveUrl);
  expect([200, 503]).toContain(result.status);
  if (result.status === 200) {
    expect(result.data.username).toBe("Snoothy");
    expect(result.data.source).toBe("scraped");
    expect(Number.isSafeInteger(result.data.current)).toBe(true);
    expect(result.data.current).toBeGreaterThanOrEqual(0);
    expect(Number.isFinite(Date.parse(result.data.updatedAt))).toBe(true);
  } else {
    expect(result.data.stale).toBe(true);
    expect(result.data.current).toBeUndefined();
  }
  console.log("Live progress API:", JSON.stringify(result));
});
