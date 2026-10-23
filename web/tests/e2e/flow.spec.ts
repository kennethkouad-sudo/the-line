import { createHmac } from "node:crypto";
import { existsSync, readFileSync } from "node:fs";
import path from "node:path";
import { expect, test, type Page, type Request } from "@playwright/test";
import pg from "pg";
import { decrypt } from "@/lib/server/envelope";
import { E2E_ENV } from "./env";
import { gotoReady, MESSAGES, openRecorder, openShare, recordFor, stubTurnstile, useOwnAddress, card } from "./helpers";

const button = (page: Page, name: string) => page.getByRole("button", { name, exact: true });

async function noteFor(token: string) {
  const client = new pg.Client({ connectionString: E2E_ENV.DATABASE_URL });
  await client.connect();
  try {
    const hash = createHmac("sha256", E2E_ENV.TOKEN_SALT).update(token).digest("hex");
    const { rows } = await client.query("SELECT * FROM notes WHERE delete_token_hash = $1", [hash]);
    return rows[0];
  } finally {
    await client.end();
  }
}

for (const lang of ["en", "fr"] as const) {
  const t = MESSAGES[lang];

  test.describe(`sender flow (${lang})`, () => {
    test.use({ locale: lang === "en" ? "en-GB" : "fr-FR" });

    test.beforeEach(async ({ page }) => {
      await useOwnAddress(page);
    });

    test("E2E 1: full flow; Put it on the line stays disabled until every consent and choice is made", async ({
      page,
    }) => {
      test.setTimeout(60_000);
      await stubTurnstile(page);
      await gotoReady(page, "/leave?from=e2e-flow");
      await openShare(page, t);
      await card(page, t.share.shareTitle).click();

      const submit = button(page, t.share.submit);
      const boxes = page.getByRole("checkbox");
      const radios = page.getByRole("radio");
      await expect(boxes).toHaveCount(3);
      await expect(radios).toHaveCount(4);
      for (const control of [...(await boxes.all()), ...(await radios.all())]) await expect(control).not.toBeChecked();

      // Each step on its own still leaves the button locked.
      await expect(submit).toBeDisabled();
      for (const consent of [t.share.consentStore, t.share.consentPublish, t.share.consentEdit]) {
        await page.getByLabel(consent).check();
        await expect(submit).toBeDisabled();
      }
      await radios.nth(0).check(); // my own voice
      await expect(submit).toBeDisabled();
      await radios.nth(3).check(); // give me 3 days
      await expect(submit).toBeEnabled();

      // Unticking any consent locks it again.
      await page.getByLabel(t.share.consentPublish).uncheck();
      await expect(submit).toBeDisabled();
      await page.getByLabel(t.share.consentPublish).check();

      const upload = page.waitForResponse((r) => r.url().endsWith("/api/notes"));
      await submit.click();
      expect((await upload).status()).toBe(201);

      await expect(page.getByRole("heading", { name: t.ticket.title })).toBeVisible();
      await expect(page.getByText(t.ticket.reviewed)).toBeVisible();
      const shown = await page.getByTestId("private-link").innerText();
      expect(shown).toMatch(/\/d\/[0-9A-Za-z]{24}$/);
      const token = shown.split("/d/")[1];

      // What was stored: all three consents, the choices, the tag, and no IP address.
      const note = await noteFor(token);
      expect(note).toMatchObject({
        status: "received",
        mode: "confide",
        consent_store: true,
        consent_publish: true,
        consent_edit: true,
        consent_text_version: "2026-10-a",
        voice_choice: "own",
        wait_choice: "three_days",
        source_tag: "e2e-flow",
        raw_audio_mime: "audio/webm",
      });
      expect(note.prompt_id).not.toBeNull();
      expect(note.duration_ms).toBeGreaterThanOrEqual(5000);
      expect(note.duration_ms).toBeLessThan(9000);
      expect(JSON.stringify(note)).not.toMatch(/198\.51\.|127\.0\.0\.1|::1/);

      // Invariant 4: the stored file is encrypted; only the master key opens it.
      const file = path.join(E2E_ENV.STORAGE_DIR, note.raw_audio_key);
      const sealed = readFileSync(file);
      expect(sealed.subarray(0, 3).toString()).toBe("TL1");
      expect(sealed.includes(Buffer.from([0x1a, 0x45, 0xdf, 0xa3]))).toBe(false);
      const plain = decrypt(sealed, Buffer.from(E2E_ENV.MASTER_KEY, "base64"));
      expect(plain.readUInt32BE(0)).toBe(0x1a45dfa3);

      // The deletion link works, and deleting is final.
      await gotoReady(page, `/d/${token}`);
      await expect(page.getByTestId("note-status")).toHaveText(t.deletion.waiting);
      await button(page, t.deletion.delete).click();
      await button(page, t.deletion.confirmNo).click();
      expect((await noteFor(token)).status).toBe("received");
      await button(page, t.deletion.delete).click();
      await button(page, t.deletion.confirmYes).click();
      await expect(page.getByTestId("note-status")).toHaveText(t.deletion.deleted);
      await expect(button(page, t.deletion.delete)).toHaveCount(0);

      const tombstone = await noteFor(token);
      expect(tombstone).toMatchObject({ status: "deleted", raw_audio_key: null, source_tag: null });
      expect(existsSync(file)).toBe(false);
    });

    test("E2E 2: Let it go uploads nothing", async ({ page, baseURL }) => {
      const turnstile = await stubTurnstile(page);
      const requests: Request[] = [];
      page.on("request", (request) => requests.push(request));

      await openShare(page, t);
      await card(page, t.share.letGoTitle).click();
      await expect(page.getByText(t.letGo.gone)).toBeVisible();
      await expect(page.getByTestId("helpline-block")).toBeVisible();
      await page.waitForLoadState("networkidle");

      expect(requests.filter((r) => r.url().includes("/api/notes"))).toEqual([]);
      expect(requests.filter((r) => r.method() !== "GET").map((r) => r.url())).toEqual([]);
      expect(requests.filter((r) => r.postData() !== null)).toEqual([]);
      expect(requests.filter((r) => !r.url().startsWith(baseURL!) && !r.url().startsWith("blob:"))).toEqual([]);
      expect(turnstile).toEqual([]);

      // "Leave another note" starts again from screen 02.
      await button(page, t.letGo.leaveAnother).click();
      await expect(page.getByRole("heading", { name: t.mode.title })).toBeVisible();
    });

    test("E2E 3: the recording stops by itself at 60 seconds", async ({ page }) => {
      await page.clock.install();
      await openRecorder(page, t);
      await button(page, t.record.start).click();
      await expect(button(page, t.record.stop)).toBeVisible();

      await page.clock.runFor(59_000);
      await expect(button(page, t.record.stop)).toBeVisible();
      await page.clock.runFor(2_000); // the 61st second

      await expect(button(page, t.record.stop)).toHaveCount(0);
      await expect(page.getByRole("timer")).toHaveText("1:00");
      await expect(button(page, t.record.done)).toBeEnabled();
      await expect(button(page, t.record.start)).toBeDisabled();
    });
  });
}

test.describe("recording screen (03)", () => {
  test("asks for the microphone only when recording starts (spec 9.2)", async ({ page }) => {
    await page.addInitScript(() => {
      const original = navigator.mediaDevices.getUserMedia.bind(navigator.mediaDevices);
      (window as unknown as { micAsks: number }).micAsks = 0;
      navigator.mediaDevices.getUserMedia = (constraints) => {
        (window as unknown as { micAsks: number }).micAsks++;
        return original(constraints);
      };
    });
    const t = MESSAGES.en;
    await openRecorder(page, t);
    expect(await page.evaluate(() => (window as unknown as { micAsks: number }).micAsks)).toBe(0);
    await button(page, t.record.start).click();
    await expect(button(page, t.record.stop)).toBeVisible();
    expect(await page.evaluate(() => (window as unknown as { micAsks: number }).micAsks)).toBe(1);
  });

  test("Done stays disabled until a recording of at least 5 seconds exists; Start over discards it", async ({
    page,
  }) => {
    const t = MESSAGES.en;
    await openRecorder(page, t);
    await expect(button(page, t.record.done)).toBeDisabled();
    await expect(button(page, t.record.startOver)).toBeDisabled();

    await recordFor(page, t, 1_500);
    await expect(page.getByText(t.record.tooShort)).toBeVisible();
    await expect(button(page, t.record.done)).toBeDisabled();

    await button(page, t.record.startOver).click();
    await expect(button(page, t.record.start)).toBeEnabled();
    await expect(page.getByRole("timer")).toHaveText("0:00");
    await expect(page.getByText(t.record.tooShort)).toHaveCount(0);

    await recordFor(page, t, 5_500);
    await expect(button(page, t.record.done)).toBeEnabled();
  });

  test("the space bar starts and stops (desktop)", async ({ page }, testInfo) => {
    test.skip(testInfo.project.name !== "desktop", "a desktop keyboard feature");
    const t = MESSAGES.en;
    await openRecorder(page, t);
    await page.locator("body").click({ position: { x: 5, y: 5 } });
    await page.keyboard.press(" ");
    await expect(button(page, t.record.stop)).toBeVisible();
    await page.waitForTimeout(5_500);
    await page.keyboard.press(" ");
    await expect(button(page, t.record.stop)).toHaveCount(0);
    await expect(button(page, t.record.done)).toBeEnabled();
  });

  test("the waveform is drawn along the line as the recording goes", async ({ page }) => {
    const t = MESSAGES.en;
    await openRecorder(page, t);
    const line = page.getByTestId("the-line");
    const box = (await line.boundingBox())!;
    expect(Math.round(box.y + box.height / 2)).toBe(page.viewportSize()!.width >= 1024 ? 540 : 500);
    await button(page, t.record.start).click();
    await page.waitForTimeout(1_500);
    const trace = await page.getByTestId("waveform").locator("path").getAttribute("d");
    expect(trace?.split("L").length).toBeGreaterThan(3);
  });
});

for (const lang of ["en", "fr"] as const) {
  test.describe(`microphone blocked (${lang})`, () => {
    test.use({ locale: lang === "en" ? "en-GB" : "fr-FR" });

    test("shows the open-in-browser screen with the helplines (spec 9.2)", async ({ page }) => {
      const t = MESSAGES[lang];
      await page.addInitScript(() => {
        navigator.mediaDevices.getUserMedia = () => Promise.reject(new DOMException("denied", "NotAllowedError"));
      });
      await openRecorder(page, t);
      await button(page, t.record.start).click();
      await expect(page.getByRole("heading", { name: t.micBlocked.title })).toBeVisible();
      await expect(page.getByText(t.micBlocked.body)).toBeVisible();
      await expect(button(page, t.micBlocked.copy)).toBeVisible();
      await expect(page.getByTestId("helpline-block")).toBeVisible();
    });
  });
}

test.describe("screen 04 and Turnstile (decisions log)", () => {
  test("Cloudflare is contacted only after Share it, and nothing else outside", async ({ page, baseURL }) => {
    await useOwnAddress(page);
    const calls = await stubTurnstile(page);
    const offsite: string[] = [];
    page.on("request", (r) => {
      if (!r.url().startsWith(baseURL!) && !r.url().startsWith("blob:") && !r.url().startsWith("data:"))
        offsite.push(r.url());
    });
    const t = MESSAGES.en;
    await openShare(page, t);
    await page.waitForLoadState("networkidle");
    expect(offsite).toEqual([]);

    await card(page, t.share.shareTitle).click();
    await expect.poll(() => calls.length).toBe(1);
    expect(offsite.every((url) => url.startsWith("https://challenges.cloudflare.com/turnstile/"))).toBe(true);
  });

  test("shows the approved review wording and the spec's consent texts", async ({ page }) => {
    await stubTurnstile(page);
    const t = MESSAGES.en;
    await openShare(page, t);
    await card(page, t.share.shareTitle).click();
    await expect(
      page.getByText("A person reviews every note before it's shared.").filter({ visible: true }),
    ).toBeVisible();
    await expect(
      page.getByText(
        "Share it without my name on social posts, the newsletter and The Line library, a page on histrnger.com where anyone, anywhere, can listen to notes left by strangers, sorted by theme. It stays there until I delete it with my private link.",
      ),
    ).toBeVisible();
  });
});
