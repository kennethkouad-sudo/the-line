import { afterEach, describe, expect, it, vi } from "vitest";
import { NextRequest } from "next/server";
import { proxy } from "@/proxy";

const request = (path: string, auth?: string) =>
  new NextRequest(`https://the-line.cleverapps.io${path}`, auth ? { headers: { authorization: auth } } : undefined);
const basic = (user: string, password: string) => `Basic ${Buffer.from(`${user}:${password}`).toString("base64")}`;

describe("staging protection (decisions log)", () => {
  afterEach(() => vi.unstubAllEnvs());

  it("does nothing outside staging", () => {
    vi.stubEnv("APP_ENV", "production");
    const response = proxy(request("/leave"));
    expect(response.status).toBe(200);
    expect(response.headers.get("x-robots-tag")).toBeNull();
  });

  it("asks for the password, and lets the right one in, with noindex", () => {
    vi.stubEnv("APP_ENV", "staging");
    vi.stubEnv("STAGING_USER", "kenneth");
    vi.stubEnv("STAGING_PASSWORD", "correct horse");

    const none = proxy(request("/leave"));
    expect(none.status).toBe(401);
    expect(none.headers.get("www-authenticate")).toContain("Basic");
    expect(none.headers.get("x-robots-tag")).toContain("noindex");

    expect(proxy(request("/leave", basic("kenneth", "wrong"))).status).toBe(401);
    expect(proxy(request("/leave", basic("someone", "correct horse"))).status).toBe(401);
    expect(proxy(request("/api/notes", "Bearer x")).status).toBe(401);

    const ok = proxy(request("/leave", basic("kenneth", "correct horse")));
    expect(ok.status).toBe(200);
    expect(ok.headers.get("x-robots-tag")).toContain("noindex");
  });

  it("stays closed if no password is set", () => {
    vi.stubEnv("APP_ENV", "staging");
    vi.stubEnv("STAGING_USER", "");
    vi.stubEnv("STAGING_PASSWORD", "");
    expect(proxy(request("/leave", basic("", ""))).status).toBe(503);
  });

  it("leaves the health check open, so the host can see the app is up", () => {
    vi.stubEnv("APP_ENV", "staging");
    vi.stubEnv("STAGING_USER", "kenneth");
    vi.stubEnv("STAGING_PASSWORD", "x");
    expect(proxy(request("/api/health")).status).toBe(200);
  });
});
