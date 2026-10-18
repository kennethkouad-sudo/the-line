import { expect, test } from "@playwright/test";
import { approvedGateCopy, gotoReady, HIDDEN_UNTIL_V1_1 } from "./helpers";

test.describe("screen 01, the gate", () => {
  test("Pick up the line stays disabled until the 18+ box is ticked", async ({ page }) => {
    await gotoReady(page, "/leave");
    const adult = page.getByLabel("I'm 18 or older.");
    const pickUp = page.getByRole("button", { name: "PICK UP THE LINE" });

    await expect(adult).not.toBeChecked();
    await expect(pickUp).toBeDisabled();

    await adult.check();
    await expect(pickUp).toBeEnabled();

    // M0: it unlocks but goes nowhere yet (wired to screen 02 in M1).
    await pickUp.click();
    await expect(page).toHaveURL(/\/leave$/);

    await adult.uncheck();
    await expect(pickUp).toBeDisabled();
  });

  test("shows every approved English string", async ({ page }) => {
    await gotoReady(page, "/leave");
    const text = await page.locator("body").innerText();
    for (const { en } of approvedGateCopy().filter(({ en }) => !HIDDEN_UNTIL_V1_1.has(en))) {
      expect(text, en).toContain(en);
    }
    await expect(page.locator("html")).toHaveAttribute("lang", "en");
  });

  test("hides the library link until v1.1", async ({ page }) => {
    await gotoReady(page, "/leave");
    await expect(page.getByRole("link", { name: "Listen to strangers" })).toHaveCount(0);
  });

  test("the line crosses the screen edge to edge at the right height", async ({ page }, testInfo) => {
    await gotoReady(page, "/leave");
    const box = await page.getByTestId("the-line").boundingBox();
    const viewport = page.viewportSize()!;
    const expectedCentre = testInfo.project.name === "phone" ? 500 : 540;

    expect(box).not.toBeNull();
    expect(box!.x).toBe(0);
    expect(box!.width).toBe(viewport.width);
    expect(box!.height).toBe(2);
    expect(box!.y + box!.height / 2).toBe(expectedCentre);
    await expect(page.getByTestId("the-line")).toContainText("the line is open");
  });

  test("touch targets are at least 44 px", async ({ page }) => {
    await gotoReady(page, "/leave");
    const targets = [
      page.getByRole("button", { name: "EN" }),
      page.getByRole("button", { name: "FR" }),
      page.locator("label", { hasText: "I'm 18 or older." }),
      page.getByRole("button", { name: "PICK UP THE LINE" }),
    ];
    for (const target of targets) {
      const box = await target.boundingBox();
      const name = (await target.textContent()) ?? "";
      expect(box!.height, name).toBeGreaterThanOrEqual(44);
      expect(box!.width, name).toBeGreaterThanOrEqual(44);
    }
  });
});

test.describe("screen 01 in French", () => {
  test.use({ locale: "fr-FR" });

  test("follows the browser language and shows every approved French string", async ({ page }) => {
    await gotoReady(page, "/leave");
    await expect(page.locator("html")).toHaveAttribute("lang", "fr");
    const text = await page.locator("body").innerText();
    for (const { fr } of approvedGateCopy().filter(({ fr }) => !HIDDEN_UNTIL_V1_1.has(fr))) {
      expect(text, fr).toContain(fr);
    }
  });

  test("the gate works in French too", async ({ page }) => {
    await gotoReady(page, "/leave");
    const pickUp = page.getByRole("button", { name: "DÉCROCHE LA LIGNE" });
    await expect(pickUp).toBeDisabled();
    await page.getByLabel("J'ai 18 ans ou plus.").check();
    await expect(pickUp).toBeEnabled();
  });
});

test.describe("language toggle", () => {
  test("switches language and remembers it in a cookie", async ({ page, context }) => {
    await gotoReady(page, "/leave");
    await page.getByRole("button", { name: "FR" }).click();
    await expect(page.locator("html")).toHaveAttribute("lang", "fr");
    await expect(page.getByRole("button", { name: "DÉCROCHE LA LIGNE" })).toBeVisible();
    await expect(page.getByRole("button", { name: "FR" })).toHaveAttribute("aria-pressed", "true");

    const cookie = (await context.cookies()).find((c) => c.name === "lang");
    expect(cookie?.value).toBe("fr");
    expect(cookie?.httpOnly).toBe(true);

    await page.reload();
    await expect(page.locator("html")).toHaveAttribute("lang", "fr");

    await page.getByRole("button", { name: "EN" }).click();
    await expect(page.locator("html")).toHaveAttribute("lang", "en");
    await expect(page.getByRole("button", { name: "PICK UP THE LINE" })).toBeVisible();
  });

  test("the cookie wins over the browser language", async ({ browser }) => {
    const context = await browser.newContext({ locale: "fr-FR" });
    await context.addCookies([{ name: "lang", value: "en", url: test.info().project.use.baseURL! }]);
    const page = await context.newPage();
    await gotoReady(page, "/leave");
    await expect(page.locator("html")).toHaveAttribute("lang", "en");
    await context.close();
  });
});
