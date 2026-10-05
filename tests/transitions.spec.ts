import { expect, test, type Page } from "@playwright/test";
import { EXHIBITS } from "../lib/exhibits";

// Leaving or reaching an exhibit must never flash the stage's hidden sample text ("Every way a page
// can move.") in place of its art. Each frame records whether the sample text or the art is showing.
type Frame = { path: string; text: boolean; art: boolean };

async function record(page: Page) {
  await page.evaluate(() => {
    const w = window as unknown as { __frames: unknown[] };
    w.__frames = [];
    const tick = () => {
      const stage = document.querySelector("main.ex .stage");
      const sample = stage?.querySelector(":scope > p");
      let text = false;
      if (sample) {
        const cs = getComputedStyle(sample);
        text = cs.visibility === "visible" && +cs.opacity > 0.05 && sample.getBoundingClientRect().height > 0;
      }
      w.__frames.push({ path: location.pathname, text, art: !!stage?.querySelector(".stage-art") });
      requestAnimationFrame(tick);
    };
    tick();
  });
}

const frames = (page: Page) => page.evaluate(() => (window as unknown as { __frames: Frame[] }).__frames);
const settled = (page: Page, path: string) =>
  page.waitForFunction((p) => location.pathname === p && document.querySelector<HTMLElement>("main.ex")?.dataset.phase === "settled", path);

/** Checks one navigation's frames: no text while the art leaves, no text before the art arrives. */
function expectNoFlash(seen: Frame[], from: string) {
  const leaving = seen.filter((f) => f.path === from);
  const arriving = seen.filter((f) => f.path !== from);
  if (leaving[0]?.art) expect(leaving.filter((f) => f.text), "sample text flashed while leaving").toHaveLength(0);
  const firstArt = arriving.findIndex((f) => f.art);
  if (firstArt > 0) expect(arriving.slice(0, firstArt).filter((f) => f.text), "sample text showed before the art arrived").toHaveLength(0);
}

for (const e of EXHIBITS) {
  test(`${e.slug}: next link swaps stages without a text flash`, async ({ page }) => {
    const from = `/exhibits/${e.slug}`;
    await page.goto(from);
    await settled(page, from);
    await record(page);
    const link = page.locator(".bar nav a").last();
    const to = (await link.getAttribute("href"))!;
    await link.click();
    await settled(page, to);
    // The incoming stage is cued partway through the intro; give it time to mount.
    await page.waitForTimeout(400);
    expectNoFlash(await frames(page), from);
  });
}

test("leaving through the masthead keeps the art until the page goes", async ({ page }) => {
  const from = "/exhibits/feedback";
  await page.goto(from);
  await settled(page, from);
  await record(page);
  await page.locator("header a", { hasText: /collection/i }).first().click();
  await page.waitForURL((url) => url.pathname === "/");
  await page.waitForTimeout(300);
  expectNoFlash(await frames(page), from);
});
