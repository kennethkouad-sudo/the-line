import { readFileSync } from "node:fs";
import path from "node:path";
import type { Page } from "@playwright/test";

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
export const PUBLIC_ROUTES = ["/leave", "/privacy"];
