import { beforeEach, describe, expect, it, vi } from "vitest";

// The upload route with its outside world replaced: what matters here is the order of
// events when saving fails (spec 7: 3 notes a day, counted only for notes really saved).
const calls: string[] = [];
vi.mock("@/lib/server/turnstile", () => ({ verifyTurnstile: async () => true }));
vi.mock("@/lib/server/db", () => ({ db: () => ({}) }));
vi.mock("@/lib/server/config", () => ({ config: { rateLimitSecret: "s", publicBaseUrl: "https://x.test" } }));
vi.mock("@/lib/server/submission", async (original) => ({
  ...(await original<typeof import("@/lib/server/submission")>()),
  parseSubmission: async () => ({ ok: true, submission: {} }),
}));
vi.mock("@/lib/server/rateLimit", async (original) => ({
  ...(await original<typeof import("@/lib/server/rateLimit")>()),
  takeRateLimit: async () => (calls.push("take"), true),
  giveBackRateLimit: async () => void calls.push("give back"),
}));
const createNote = vi.fn();
vi.mock("@/lib/server/notes", () => ({ createNote: (...args: unknown[]) => createNote(...args) }));

const { POST } = await import("@/app/api/notes/route");
const post = () => POST(new Request("https://x.test/api/notes", { method: "POST", body: new FormData() }));

describe("upload route: the daily count", () => {
  beforeEach(() => {
    calls.length = 0;
    vi.spyOn(console, "error").mockImplementation(() => {});
  });

  it("is given back when the note can't be saved", async () => {
    createNote.mockRejectedValueOnce(new Error("Storage PUT failed: 403 SignatureDoesNotMatch"));
    const response = await post();
    expect(response.status).toBe(500);
    expect(calls).toEqual(["take", "give back"]);
  });

  it("is kept when the note is saved", async () => {
    createNote.mockResolvedValueOnce({ token: "T".repeat(24) });
    const response = await post();
    expect(response.status).toBe(201);
    expect(calls).toEqual(["take"]);
  });
});
