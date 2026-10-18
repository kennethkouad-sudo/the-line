import AxeBuilder from "@axe-core/playwright";
import { expect, test } from "@playwright/test";
import { gotoReady, PUBLIC_ROUTES } from "./helpers";

for (const locale of ["en-GB", "fr-FR"]) {
  test.describe(`public pages (${locale})`, () => {
    test.use({ locale });

    for (const route of PUBLIC_ROUTES) {
      test(`${route} shows the helpline block (invariant 9)`, async ({ page }) => {
        await gotoReady(page, route);
        const block = page.getByTestId("helpline-block");
        await expect(block).toBeVisible();
        await expect(block.locator('a[href="https://findahelpline.com"]')).toBeVisible();
        await expect(block.locator("strong", { hasText: "112" })).toBeVisible();
      });

      test(`${route} never says "anonymous" (invariant 8)`, async ({ page }) => {
        await gotoReady(page, route);
        expect((await page.content()).toLowerCase()).not.toContain("anonym");
      });

      test(`${route} talks to no other website, fonts included (spec 3 and 14)`, async ({ page, baseURL }) => {
        const requests: string[] = [];
        page.on("request", (request) => requests.push(request.url()));
        await gotoReady(page, route);
        await page.waitForLoadState("networkidle");

        const offsite = requests.filter((url) => !url.startsWith(baseURL!) && !url.startsWith("data:"));
        expect(offsite).toEqual([]);
        expect(requests.some((url) => url.includes("/fonts/") && url.endsWith(".woff2"))).toBe(true);
        expect(await page.evaluate(() => document.fonts.check('900 20px "Archivo"'))).toBe(true);
      });

      test(`${route} passes automated accessibility checks`, async ({ page }) => {
        await gotoReady(page, route);
        const results = await new AxeBuilder({ page }).analyze();
        expect(results.violations.map((v) => `${v.id}: ${v.help}`)).toEqual([]);
      });
    }
  });
}
