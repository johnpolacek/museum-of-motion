import { expect, test } from "@playwright/test";

// On a phone a long exhibit title wraps. Its width move must never change where the lines break:
// each word is held at its resting width while it widens or condenses.
test.use({ viewport: { width: 390, height: 844 } });

for (const slug of ["open-and-close", "type-and-speak", "entrances-and-exits", "swipe-to-dismiss"]) {
  test(`${slug}: the title keeps its lines while it widens in`, async ({ page }) => {
    await page.addInitScript(() => {
      const w = window as unknown as { __heights: number[] };
      w.__heights = [];
      const t0 = performance.now();
      const tick = () => {
        const h = document.querySelector("main.ex h1");
        if (h) w.__heights.push(Math.round(h.getBoundingClientRect().height));
        if (performance.now() - t0 < 2000) requestAnimationFrame(tick);
      };
      requestAnimationFrame(tick);
    });
    await page.goto(`/exhibits/${slug}`);
    await page.waitForTimeout(2200);
    const heights = await page.evaluate(() => (window as unknown as { __heights: number[] }).__heights);
    expect(new Set(heights).size, `title height changed: ${[...new Set(heights)].join(", ")}`).toBe(1);
    // At rest the title is plain text again.
    expect(await page.locator("main.ex h1 .t > *").count()).toBe(0);
  });
}
