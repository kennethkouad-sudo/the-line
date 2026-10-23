import AxeBuilder from "@axe-core/playwright";
import { expect, test } from "@playwright/test";
import { gotoReady, MESSAGES, PUBLIC_ROUTES, recordFor, stubTurnstile, useOwnAddress, card } from "./helpers";

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

// Screens 02–05 and the two endings live on /leave, one after the other.
for (const lang of ["en", "fr"] as const) {
  test.describe(`sender screens 02–05 (${lang})`, () => {
    test.use({ locale: lang === "en" ? "en-GB" : "fr-FR" });

    test("every screen shows the helplines, never says anonymous, and passes accessibility checks", async ({
      page,
    }) => {
      test.setTimeout(90_000);
      const t = MESSAGES[lang];
      await useOwnAddress(page);
      await stubTurnstile(page);

      const check = async (screen: string) => {
        await expect(page.getByTestId("helpline-block"), screen).toBeVisible();
        expect((await page.content()).toLowerCase(), screen).not.toContain("anonym");
        const results = await new AxeBuilder({ page }).analyze();
        expect(results.violations.map((v) => `${screen}: ${v.id}: ${v.help}`)).toEqual([]);
      };

      await gotoReady(page, "/leave");
      await page.getByLabel(t.gate.adultCheckbox).check();
      await page.getByRole("button", { name: t.gate.pickUp, exact: true }).click();
      await check("02");
      await card(page, t.mode.confideTitle).click();
      await check("03");
      await recordFor(page, t, 5_500);
      await check("03 recorded");
      await page.getByRole("button", { name: t.record.done, exact: true }).click();
      await check("04");
      await card(page, t.share.shareTitle).click();
      await check("04 share it");
      for (const box of await page.getByRole("checkbox").all()) await box.check();
      await page.getByRole("radio").nth(1).check();
      await page.getByRole("radio").nth(2).check();
      await page.getByRole("button", { name: t.share.submit, exact: true }).click();
      await page.getByTestId("private-link").waitFor();
      await check("05");
      await page.getByRole("button", { name: t.ticket.leaveAnother, exact: true }).click();
      await card(page, t.mode.encourageTitle).click();
      await expect(page.getByText(t.mode.encouragePrompt)).toBeVisible();
      await recordFor(page, t, 5_500);
      await page.getByRole("button", { name: t.record.done, exact: true }).click();
      await card(page, t.share.letGoTitle).click();
      await check("after let it go");
    });
  });
}
