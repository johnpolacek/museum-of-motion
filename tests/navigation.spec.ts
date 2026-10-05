import { expect, test, type Page } from "@playwright/test";

// Moving around the home page. The address stays "/": "#collection" is a one-time instruction for
// arriving. Back, Forward, and reload return to the exact spot the page was left at.
const y = (page: Page) => page.evaluate(() => Math.round(window.scrollY));
const collectionTop = (page: Page) => page.evaluate(() => Math.round(document.getElementById("collection")!.getBoundingClientRect().top));
const address = (page: Page) => page.evaluate(() => location.pathname + location.hash);
const focused = (page: Page) => page.evaluate(() => document.activeElement?.id ?? "");
const settled = (page: Page, path: string) =>
  page.waitForFunction((p) => location.pathname === p && document.querySelector<HTMLElement>("[data-motion-owner][data-phase]")?.dataset.phase !== "initial", path);
const collectionLink = (page: Page) => page.locator("header.mast nav a", { hasText: /collection/i });

test("the Collection link glides to the collection every time, keeps the address clean, and moves focus", async ({ page }) => {
  await page.goto("/");
  await settled(page, "/");
  for (let i = 0; i < 2; i++) {
    await page.evaluate(() => window.scrollTo(0, 0));
    await collectionLink(page).click();
    await expect.poll(() => collectionTop(page)).toBe(0);
    expect(await address(page)).toBe("/");
    expect(await focused(page)).toBe("coll-h");
  }
  await page.locator("header.mast a.word").click();
  await expect.poll(() => y(page)).toBe(0);
});

test("the Collection link from an exhibit lands at the collection with a clean address", async ({ page }) => {
  await page.goto("/exhibits/scramble");
  await settled(page, "/exhibits/scramble");
  await collectionLink(page).click();
  await page.waitForURL((url) => url.pathname === "/");
  await expect.poll(() => collectionTop(page)).toBe(0);
  await expect.poll(() => address(page)).toBe("/");
  expect(await focused(page)).toBe("coll-h");
});

test("a shared /#collection link opens at the collection, then the hash is cleared", async ({ page }) => {
  await page.goto("/#collection");
  await expect.poll(() => address(page)).toBe("/");
  expect(await collectionTop(page)).toBe(0);
});

test("Back, Forward, and reload return to the exact spot", async ({ page }) => {
  await page.goto("/");
  await settled(page, "/");
  await page.evaluate(() => window.scrollTo(0, 1400));
  await expect.poll(() => y(page)).toBe(1400);
  await page.waitForTimeout(200);
  // A click, not a scroll into view first, so the home page is left at 1400.
  await page.evaluate(() => document.querySelector<HTMLAnchorElement>('.names a[href="/exhibits/sortable"]')!.click());
  await settled(page, "/exhibits/sortable");
  expect(await y(page)).toBe(0);
  await page.evaluate(() => window.scrollTo(0, 150));
  await page.waitForTimeout(200);
  await page.goBack();
  await settled(page, "/");
  await expect.poll(() => y(page)).toBe(1400);
  await page.waitForTimeout(800);
  expect(await y(page)).toBe(1400);
  await page.goForward();
  await settled(page, "/exhibits/sortable");
  await page.waitForTimeout(800);
  expect(await y(page)).toBe(150);
  await page.goBack();
  await settled(page, "/");
  await page.evaluate(() => window.scrollTo(0, 1234));
  await page.waitForTimeout(200);
  await page.reload();
  await settled(page, "/");
  await page.waitForTimeout(800);
  expect(await y(page)).toBe(1234);
});
