import { randomBytes } from "node:crypto";
import { describe, expect, it } from "vitest";
import { decrypt, encrypt } from "@/lib/server/envelope";
import { DELETE_TOKEN_PATTERN, hashDeleteToken, newDeleteToken, newPublicId, randomBase62 } from "@/lib/server/ids";
import { clientIp, rateLimitKey } from "@/lib/server/rateLimit";

describe("tokens and ids (spec 4 and 5, invariant 5)", () => {
  it("makes deletion tokens of 22+ base62 characters, all different", () => {
    const tokens = new Set(Array.from({ length: 2000 }, newDeleteToken));
    expect(tokens.size).toBe(2000);
    for (const token of tokens) expect(token).toMatch(DELETE_TOKEN_PATTERN);
  });

  it("makes 10-character public ids", () => {
    expect(newPublicId()).toMatch(/^[0-9A-Za-z]{10}$/);
  });

  it("uses every base62 character", () => {
    expect(new Set(randomBase62(20_000)).size).toBe(62);
  });

  it("stores only a salted hash of the token", () => {
    const token = newDeleteToken();
    const hash = hashDeleteToken(token, "salt-a");
    expect(hash).toMatch(/^[0-9a-f]{64}$/);
    expect(hash).not.toContain(token);
    expect(hashDeleteToken(token, "salt-a")).toBe(hash);
    expect(hashDeleteToken(token, "salt-b")).not.toBe(hash);
  });
});

describe("envelope encryption (spec 14, invariant 4)", () => {
  const masterKey = randomBytes(32);

  it("round-trips, and never stores the plain audio", () => {
    const audio = Buffer.from("OggS pretend audio ".repeat(50));
    const sealed = encrypt(audio, masterKey);
    expect(sealed.includes(Buffer.from("pretend audio"))).toBe(false);
    expect(decrypt(sealed, masterKey).equals(audio)).toBe(true);
  });

  it("uses a fresh key each time", () => {
    const audio = Buffer.from("same audio");
    expect(encrypt(audio, masterKey).equals(encrypt(audio, masterKey))).toBe(false);
  });

  it("refuses the wrong master key and tampered files", () => {
    const sealed = encrypt(Buffer.from("audio"), masterKey);
    expect(() => decrypt(sealed, randomBytes(32))).toThrow();
    const tampered = Buffer.from(sealed);
    tampered[tampered.length - 1] ^= 1;
    expect(() => decrypt(tampered, masterKey)).toThrow();
  });
});

describe("rate-limit key (spec 5, invariant 6)", () => {
  const day = new Date("2026-10-23T10:00:00Z");

  it("never contains the IP, and changes every day", () => {
    const key = rateLimitKey("203.0.113.7", "secret", day);
    expect(key).not.toContain("203.0.113.7");
    expect(rateLimitKey("203.0.113.7", "secret", new Date("2026-10-23T23:59:00Z"))).toBe(key);
    expect(rateLimitKey("203.0.113.7", "secret", new Date("2026-10-24T00:01:00Z"))).not.toBe(key);
    expect(rateLimitKey("203.0.113.8", "secret", day)).not.toBe(key);
  });

  it("uses the address the last proxy saw, not one the visitor wrote", () => {
    expect(clientIp(new Headers({ "x-forwarded-for": "1.1.1.1, 203.0.113.7" }))).toBe("203.0.113.7");
    expect(clientIp(new Headers())).toBe("unknown");
  });
});
