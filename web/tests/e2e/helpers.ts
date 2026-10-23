import { readFileSync } from "node:fs";
import path from "node:path";
import type { Page } from "@playwright/test";
import en from "../../messages/en.json";
import fr from "../../messages/fr.json";
import { TEST_BOT_TOKEN } from "./env";

/** Waits until the self-hosted fonts are in, so measurements match what people see. */
export async function gotoReady(page: Page, url: string) {
  const response = await page.goto(url);
  await page.evaluate(() => document.fonts.ready);
  return response;
}

/** The approved screen 01 copy, read from the decisions log in the spec (section 17). */
export function approvedGateCopy(): { en: string; fr: string }[] {
  const spec = readFileSync(path.join(__dirname, "../../../The_Line_Build_Spec.md"), "utf8");
  const start = spec.indexOf("**Screen 01 French copy");
  const table = spec.slice(start, spec.indexOf("\n\n", spec.indexOf("| EN | FR |", start)));
  return table
    .split("\n")
    .filter((row) => row.startsWith("|") && !row.startsWith("| EN |") && !row.startsWith("|---"))
    .map((row) => {
      const [en, fr] = row
        .split("|")
        .slice(1, 3)
        .map((cell) => cell.trim());
      return { en, fr };
    });
}

/** Strings that exist in the approved table but are hidden until v1.1 (library link). */
export const HIDDEN_UNTIL_V1_1 = new Set(["Listen to strangers", "Écouter des inconnus"]);

/** Every sender and public route that exists so far. Add new ones here. */
export const PUBLIC_ROUTES = ["/leave", "/privacy", "/d/0000000000000000000000"];

// --- The sender flow (M1) ---------------------------------------------------------

export const MESSAGES = { en, fr };
export type Messages = typeof en;

/**
 * Stands in for Cloudflare's Turnstile script in the browser: it hands out the test token.
 * Every request to Cloudflare is recorded, so tests can check when it was loaded.
 */
export async function stubTurnstile(page: Page): Promise<string[]> {
  const calls: string[] = [];
  await page.route("https://challenges.cloudflare.com/**", (route) => {
    calls.push(route.request().url());
    return route.fulfill({
      contentType: "text/javascript",
      body: `window.turnstile = {
        _widgets: {},
        render(el, options) {
          const id = "w" + Object.keys(this._widgets).length;
          this._widgets[id] = options;
          setTimeout(() => options.callback(${JSON.stringify(TEST_BOT_TOKEN)}), 30);
          return id;
        },
        reset(id) { const o = this._widgets[id]; if (o) setTimeout(() => o.callback(${JSON.stringify(TEST_BOT_TOKEN)}), 30); },
        remove(id) { delete this._widgets[id]; },
      };`,
    });
  });
  return calls;
}

let nextIp = 1;
/** Each test gets its own made-up address (TEST-NET-2), so the 3-a-day limit doesn't collide. */
export async function useOwnAddress(page: Page) {
  const n = (process.pid * 7 + nextIp++) % 65000;
  await page.setExtraHTTPHeaders({ "x-forwarded-for": `198.51.${100 + ((n >> 8) % 100)}.${n % 256}` });
}

/** Gate (01) → mode (02) → the recording screen (03). */
export async function openRecorder(page: Page, t: Messages, mode: "confide" | "encourage" = "confide") {
  await gotoReady(page, "/leave");
  await page.getByLabel(t.gate.adultCheckbox).check();
  await page.getByRole("button", { name: t.gate.pickUp, exact: true }).click();
  await card(page, mode === "confide" ? t.mode.confideTitle : t.mode.encourageTitle).click();
  await page.getByRole("button", { name: t.record.start, exact: true }).waitFor();
}

/** Records for about `ms` of real time with Chrome's fake microphone, then stops. */
export async function recordFor(page: Page, t: Messages, ms: number) {
  await page.getByRole("button", { name: t.record.start, exact: true }).click();
  const stop = page.getByRole("button", { name: t.record.stop, exact: true });
  await stop.waitFor();
  await page.waitForTimeout(ms);
  await stop.click();
}

/** All the way to screen 04 with a recording of about 6 seconds. */
export async function openShare(page: Page, t: Messages) {
  await openRecorder(page, t);
  await recordFor(page, t, 6_000);
  await page.getByRole("button", { name: t.record.done, exact: true }).click();
  await page.getByRole("heading", { name: t.share.title }).waitFor();
}

/** A card button (02, 04): its name is its title followed by its description. */
export function card(page: Page, title: string) {
  const escaped = title.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
  return page.getByRole("button", { name: new RegExp(`^${escaped}\\b`) });
}
