import { expect, test } from "@playwright/test";
import { gotoReady } from "./helpers";

const storedTag = (page: import("@playwright/test").Page) =>
  page.evaluate(() => sessionStorage.getItem("line.source_tag"));

test.describe("routes and source tags (spec sections 1 and 4)", () => {
  test("/ redirects to /leave and keeps the query string", async ({ page }) => {
    await gotoReady(page, "/?from=intro");
    await expect(page).toHaveURL(/\/leave\?from=intro$/);
    await expect.poll(() => storedTag(page)).toBe("intro");
  });

  test("keeps the first tag of the session", async ({ page }) => {
    await gotoReady(page, "/leave?from=car-1022");
    await expect.poll(() => storedTag(page)).toBe("car-1022");
    await gotoReady(page, "/leave?from=nl-25oct");
    await page.waitForLoadState("networkidle");
    expect(await storedTag(page)).toBe("car-1022");
  });

  test("drops tags that don't match [a-z0-9-]{1,32}", async ({ page }) => {
    for (const bad of ["Intro", "a%20b", "x".repeat(33), "%3Cscript%3E"]) {
      await gotoReady(page, `/leave?from=${bad}`);
      await page.waitForLoadState("networkidle");
      expect(await storedTag(page), bad).toBeNull();
    }
  });
});
