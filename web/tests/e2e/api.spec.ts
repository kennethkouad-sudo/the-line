import { readFileSync } from "node:fs";
import path from "node:path";
import { expect, test, type APIRequestContext } from "@playwright/test";
import { TEST_BOT_TOKEN } from "./env";

// Spec 7: the upload checks, sent straight to the server. Run once (they don't depend on screen size).
test.skip(({ viewport }) => (viewport?.width ?? 0) < 1024, "server checks run once, in the desktop project");

const tone = (name: string) => readFileSync(path.join(__dirname, "../fixtures/audio", name));

let address = 0;
const newAddress = () => `203.0.113.${(process.pid + address++) % 250}`;

type Overrides = { file?: Buffer; mime?: string; [field: string]: string | null | Buffer | undefined };

async function upload(request: APIRequestContext, ip: string, overrides: Overrides = {}) {
  const { file = tone("tone-6500ms.webm"), mime = "audio/webm;codecs=opus", ...fieldOverrides } = overrides;
  const fields: Record<string, string | null> = {
    mode: "confide",
    prompt: "weekly",
    consent_store: "yes",
    consent_publish: "yes",
    consent_edit: "yes",
    consent_text_version: "2026-10-a",
    voice: "narrator",
    wait: "asap",
    duration_ms: "6500",
    "cf-turnstile-response": TEST_BOT_TOKEN,
    ...(fieldOverrides as Record<string, string | null>),
  };
  const multipart: Record<string, string | { name: string; mimeType: string; buffer: Buffer }> = {
    audio: { name: "note.webm", mimeType: mime, buffer: file },
  };
  for (const [key, value] of Object.entries(fields)) if (value !== null) multipart[key] = value as string;
  return request.post("/api/notes", { multipart, headers: { "x-forwarded-for": ip } });
}

test.describe("upload API (spec 7)", () => {
  test("accepts a valid note and returns the deletion link once", async ({ request }) => {
    const response = await upload(request, newAddress());
    expect(response.status()).toBe(201);
    const body = await response.json();
    expect(body.token).toMatch(/^[0-9A-Za-z]{24}$/);
    expect(body.deleteUrl).toMatch(new RegExp(`/d/${body.token}$`));
    expect(response.headers()["cache-control"]).toContain("no-store");
  });

  test("accepts MP4 (Safari) recordings too", async ({ request }) => {
    const response = await upload(request, newAddress(), { file: tone("tone-6500ms-frag.mp4"), mime: "audio/mp4" });
    expect(response.status()).toBe(201);
  });

  for (const consent of ["consent_store", "consent_publish", "consent_edit"]) {
    test(`refuses a note without ${consent} (invariant 1)`, async ({ request }) => {
      expect((await upload(request, newAddress(), { [consent]: null })).status()).toBe(400);
      expect((await upload(request, newAddress(), { [consent]: "no" })).status()).toBe(400);
    });
  }

  test("refuses missing voice or timing choices, and an old consent wording", async ({ request }) => {
    expect((await upload(request, newAddress(), { voice: null })).status()).toBe(400);
    expect((await upload(request, newAddress(), { wait: "tomorrow" })).status()).toBe(400);
    expect((await upload(request, newAddress(), { consent_text_version: "2025-01-a" })).status()).toBe(400);
  });

  test("refuses a missing or wrong bot-check token", async ({ request }) => {
    expect((await upload(request, newAddress(), { "cf-turnstile-response": null })).status()).toBe(403);
    expect((await upload(request, newAddress(), { "cf-turnstile-response": "forged" })).status()).toBe(403);
  });

  test("refuses files that aren't WebM or MP4 audio, whatever they claim to be", async ({ request }) => {
    const html = Buffer.from("<html><script>alert(1)</script></html>");
    expect((await upload(request, newAddress(), { file: html })).status()).toBe(415);
    expect((await upload(request, newAddress(), { mime: "audio/wav" })).status()).toBe(415);
    const mp4AsWebm = { file: tone("tone-6500ms.m4a"), mime: "audio/webm" };
    expect((await upload(request, newAddress(), mp4AsWebm)).status()).toBe(415);
  });

  test("checks the length in the file itself, not the browser's figure", async ({ request }) => {
    const short = await upload(request, newAddress(), { file: tone("tone-2000ms.webm"), duration_ms: "30000" });
    expect(short.status()).toBe(422);
    expect((await short.json()).error).toBe("too_short");
  });

  test("refuses files over 3 MB", async ({ request }) => {
    const big = Buffer.concat([tone("tone-6500ms.webm"), Buffer.alloc(3 * 1024 * 1024)]);
    expect((await upload(request, newAddress(), { file: big })).status()).toBe(413);
  });

  test("allows 3 notes a day per connection, then refuses", async ({ request }) => {
    const ip = newAddress();
    for (let i = 0; i < 3; i++) expect((await upload(request, ip)).status()).toBe(201);
    const fourth = await upload(request, ip);
    expect(fourth.status()).toBe(429);
    expect((await fourth.json()).error).toBe("rate_limited");
    // Another connection is unaffected.
    expect((await upload(request, newAddress())).status()).toBe(201);
  });

  test("a refused upload doesn't use up the day's allowance", async ({ request }) => {
    const ip = newAddress();
    for (let i = 0; i < 4; i++) expect((await upload(request, ip, { consent_edit: null })).status()).toBe(400);
    expect((await upload(request, ip)).status()).toBe(201);
  });
});

test.describe("raw is private (invariant 4)", () => {
  test("no route lists or serves notes or stored recordings", async ({ request }) => {
    const created = await (await upload(request, newAddress())).json();
    expect((await request.get("/api/notes")).status()).toBe(405);
    for (const url of ["/.storage/e2e", "/storage/raw", `/api/notes/${created.token}`, "/raw"]) {
      const response = await request.get(url);
      expect(response.status(), url).toBe(404);
      expect(response.headers()["content-type"] ?? "").not.toMatch(/audio|octet-stream/);
    }
  });
});

test.describe("deletion link (invariant 5)", () => {
  test("an unknown or malformed token shows not found and no delete button", async ({ page }) => {
    for (const token of ["0000000000000000000000", "short", "has-dashes-and-more-than-22"]) {
      await page.goto(`/d/${token}`);
      await expect(page.getByTestId("note-status")).toHaveAttribute("data-status", "not_found");
      await expect(page.getByRole("button", { name: /delete/i })).toHaveCount(0);
    }
  });

  test("the page is never cached, indexed or sent on as a referrer", async ({ request }) => {
    const created = await (await upload(request, newAddress())).json();
    const response = await request.get(`/d/${created.token}`);
    expect(response.status()).toBe(200);
    expect(response.headers()["referrer-policy"]).toBe("no-referrer");
    expect(response.headers()["cache-control"]).toContain("no-store");
    expect(response.headers()["x-robots-tag"]).toContain("noindex");
  });
});
