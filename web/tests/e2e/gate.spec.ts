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

    await adult.uncheck();
    await expect(pickUp).toBeDisabled();

    // M1: it leads to screen 02, on the same page.
    await adult.check();
    await pickUp.click();
    await expect(page.getByRole("heading", { name: "WHO IS IT FOR?" })).toBeVisible();
    await expect(page).toHaveURL(/\/leave$/);
  });

  test("locked and unlocked looks (decisions log)", async ({ page }) => {
    await gotoReady(page, "/leave");
    const pickUp = page.getByRole("button", { name: "PICK UP THE LINE" });
    const ink = "rgb(42, 30, 18)";
    const cream = "rgb(246, 239, 228)";

    // Locked: cream background, 2 px ink border, ink text at 50% opacity.
    await expect(pickUp).toHaveCSS("background-color", cream);
    await expect(pickUp).toHaveCSS("border-top-width", "2px");
    await expect(pickUp).toHaveCSS("border-top-color", ink);
    await expect(pickUp).toHaveCSS("color", "rgba(42, 30, 18, 0.5)");
    await expect(pickUp).toHaveCSS("opacity", "1");

    // Unlocked: solid ink with cream text, as in the design.
    await page.getByLabel("I'm 18 or older.").check();
    await expect(pickUp).toHaveCSS("background-color", ink);
    await expect(pickUp).toHaveCSS("color", cream);
  });

  test("desktop sizes and positions match DGate", async ({ page }, testInfo) => {
    test.skip(testInfo.project.name !== "desktop", "DGate is the 1440 px design");
    await gotoReady(page, "/leave");

    // [font size, left, top, width, height] measured from design/DGate.dc.html at 1440×900.
    const expected: [string, import("@playwright/test").Locator, string, number[]][] = [
      ["title", page.getByRole("heading", { level: 1 }), "330px", [50, 88, -1, 264]],
      ["tagline", page.getByText("Leave your voice for a stranger."), "30px", [64, 400, 560, -1]],
      ["helpline", page.getByText("This line isn't monitored live."), "18px", [64, 610, 560, 25]],
      ["checkbox label", page.locator("label", { hasText: "I'm 18 or older." }), "19px", [860, 610, 516, 44]],
      ["button", page.getByRole("button", { name: "PICK UP THE LINE" }), "32px", [860, 672, 516, 72]],
      ["hint", page.getByText("Works best in Chrome or Safari."), "14px", [860, 762, 516, -1]],
    ];
    for (const [name, locator, fontSize, [left, top, width, height]] of expected) {
      await expect(locator, name).toHaveCSS("font-size", fontSize);
      const box = (await locator.boundingBox())!;
      expect(Math.round(box.x), `${name} left`).toBe(left);
      expect(Math.round(box.y), `${name} top`).toBe(top);
      if (width >= 0) expect(Math.round(box.width), `${name} width`).toBe(width);
      if (height >= 0) expect(Math.round(box.height), `${name} height`).toBe(height);
    }
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
