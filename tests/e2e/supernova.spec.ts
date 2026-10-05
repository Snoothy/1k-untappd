import { test, expect, type Page } from "@playwright/test";

const site = "/1k-untappd/";
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

test("refreshes deployed snapshots without replacing confirmed data with fallback", async ({
  page,
}) => {
  let response = { ...data };
  await page.route(`**${site}progress.json`, (route) =>
    route.fulfill({ json: response }),
  );
  await page.emulateMedia({ reducedMotion: "reduce" });
  await page.clock.install();
  await loaded(page);
  await page.clock.fastForward(60_100);
  await expect(page.locator(".sn-count")).toHaveText("987");
  await expect(page.locator(".sn-demo")).toHaveText("UNTAPPD SNAPSHOT");
  await page.keyboard.press("Space");
  await expect(page.locator(".sn-count")).toHaveText("1,000");
  response = { ...data, current: 992, updatedAt: "2026-10-05T17:05:00Z" };
  await page.clock.fastForward(60_100);
  await page.keyboard.press("Space");
  await expect(page.locator(".sn-count")).toHaveText("992");
  response = {
    ...data,
    current: 800,
    source: "fallback",
    updatedAt: "2026-10-05T17:10:00Z",
  };
  await page.clock.fastForward(60_100);
  await expect(page.locator(".sn-count")).toHaveText("992");
  response = { ...data, current: 1043, updatedAt: "2026-10-05T17:15:00Z" };
  await page.clock.fastForward(60_100);
  await expect(page.locator(".sn-count")).toHaveText("1,043");
  await expect(page.getByRole("progressbar")).toHaveAttribute(
    "aria-valuenow",
    "1000",
  );
  await page.clock.fastForward(20_000);
  await expect(page.locator(".sn-count")).toHaveText("1,043");
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
