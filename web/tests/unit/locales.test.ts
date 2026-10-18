import { describe, expect, it } from "vitest";
import { pickLocale } from "@/i18n/locales";

describe("pickLocale (spec 9.5)", () => {
  it("uses the toggle cookie over the browser language", () => {
    expect(pickLocale("fr", "en-GB,en;q=0.9")).toBe("fr");
    expect(pickLocale("en", "fr-FR,fr;q=0.9")).toBe("en");
  });

  it("ignores an unknown cookie value", () => {
    expect(pickLocale("de", "fr-FR")).toBe("fr");
  });

  it("matches regional variants of French", () => {
    expect(pickLocale(undefined, "fr-CA")).toBe("fr");
    expect(pickLocale(undefined, "fr-BE,nl;q=0.8")).toBe("fr");
  });

  it("follows q-values, not just order", () => {
    expect(pickLocale(undefined, "en;q=0.4,fr;q=0.8")).toBe("fr");
    expect(pickLocale(undefined, "de-DE,fr;q=0.5,en;q=0.7")).toBe("en");
  });

  it("skips languages we don't have", () => {
    expect(pickLocale(undefined, "de-DE,es;q=0.9,fr;q=0.3")).toBe("fr");
  });

  it("ignores languages refused with q=0", () => {
    expect(pickLocale(undefined, "fr;q=0,en;q=0.1")).toBe("en");
  });

  it("falls back to English", () => {
    expect(pickLocale(undefined, null)).toBe("en");
    expect(pickLocale(undefined, "")).toBe("en");
    expect(pickLocale(undefined, "de,ja")).toBe("en");
    expect(pickLocale(undefined, "*")).toBe("en");
  });
});
