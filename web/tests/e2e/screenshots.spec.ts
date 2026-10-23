import path from "node:path";
import { test } from "@playwright/test";
import { gotoReady, MESSAGES, openRecorder, openShare, stubTurnstile, useOwnAddress, card } from "./helpers";

// Pull-request screenshots of screens 02–05 and the deletion page.
// Not part of the normal run: SCREENSHOTS=1 npm run test:e2e -- screenshots
test.skip(!process.env.SCREENSHOTS, "set SCREENSHOTS=1 to take the screenshots");
test.describe.configure({ mode: "serial" });

const OUT = path.join(__dirname, "../../../docs/screenshots/m1");

for (const lang of ["en", "fr"] as const) {
  test.describe(lang, () => {
    test.use({ locale: lang === "en" ? "en-GB" : "fr-FR" });
    const t = MESSAGES[lang];

    test(`all screens (${lang})`, async ({ page }, testInfo) => {
      test.setTimeout(120_000);
      const shot = (name: string) =>
        page.screenshot({ path: path.join(OUT, `${name}-${testInfo.project.name}-${lang}.png`), fullPage: true });
      await useOwnAddress(page);
      await stubTurnstile(page);

      await gotoReady(page, "/leave");
      await page.getByLabel(t.gate.adultCheckbox).check();
      await page.getByRole("button", { name: t.gate.pickUp, exact: true }).click();
      await card(page, t.mode.confideTitle).waitFor();
      await shot("02-mode");

      await card(page, t.mode.confideTitle).click();
      await shot("03-record-ready");
      await page.getByRole("button", { name: t.record.start, exact: true }).click();
      await page.waitForTimeout(6_500);
      await shot("03-recording");
      await page.getByRole("button", { name: t.record.stop, exact: true }).click();
      await page.getByRole("button", { name: t.record.done, exact: true }).click();

      await shot("04-what-now");
      await card(page, t.share.shareTitle).click();
      await shot("04-share-it");
      await page.getByLabel(t.share.consentStore).check();
      await page.getByLabel(t.share.consentPublish).check();
      await page.getByLabel(t.share.consentEdit).check();
      await page.getByRole("radio").first().check();
      await page.getByRole("radio").nth(3).check();
      await page.getByRole("button", { name: t.share.submit, exact: true }).click();
      const link = page.getByTestId("private-link");
      await link.waitFor();
      await shot("05-private-link");

      const url = `https://${await link.innerText()}`;
      await page.goto(new URL(url).pathname);
      await shot("deletion-waiting");
      await page.getByRole("button", { name: t.deletion.delete, exact: true }).click();
      await shot("deletion-confirm");
      await page.getByRole("button", { name: t.deletion.confirmYes, exact: true }).click();
      await page.getByText(t.deletion.deleted).waitFor();
      await shot("deletion-deleted");

      await openShare(page, t);
      await card(page, t.share.letGoTitle).click();
      await page.getByText(t.letGo.gone).waitFor();
      await shot("after-let-it-go");

      await page.addInitScript(() => {
        navigator.mediaDevices.getUserMedia = () => Promise.reject(new DOMException("denied", "NotAllowedError"));
      });
      await openRecorder(page, t);
      await page.getByRole("button", { name: t.record.start, exact: true }).click();
      await page.getByText(t.micBlocked.title).waitFor();
      await shot("03-microphone-blocked");
    });
  });
}
