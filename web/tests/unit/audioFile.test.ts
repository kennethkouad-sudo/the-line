import { readFileSync } from "node:fs";
import path from "node:path";
import { describe, expect, it } from "vitest";
import { audioDurationMs, sniffAudio } from "@/lib/server/audioFile";

// Synthetic tones made with ffmpeg (no voices). See tests/fixtures/audio/README.md.
const fixture = (name: string) => readFileSync(path.join(__dirname, "../fixtures/audio", name));

describe("audio file checks (spec 7)", () => {
  it.each([
    ["tone-6500ms.webm", "audio/webm"],
    ["tone-6500ms-live.webm", "audio/webm"],
    ["tone-6500ms.m4a", "audio/mp4"],
    ["tone-6500ms-frag.mp4", "audio/mp4"],
  ] as const)("reads the type and length of %s", (name, kind) => {
    const data = fixture(name);
    expect(sniffAudio(data)).toBe(kind);
    expect(Math.abs(audioDurationMs(data, kind)! - 6500)).toBeLessThan(150);
  });

  it("reads a short recording as short", () => {
    expect(audioDurationMs(fixture("tone-2000ms.webm"), "audio/webm")).toBeLessThan(2100);
  });

  it("rejects files that aren't WebM or MP4", () => {
    expect(sniffAudio(Buffer.from("RIFF....WAVEfmt "))).toBeNull();
    expect(sniffAudio(Buffer.from("<html></html>"))).toBeNull();
    expect(sniffAudio(Buffer.alloc(0))).toBeNull();
  });

  it("returns null instead of crashing on broken files", () => {
    const cut = fixture("tone-6500ms.webm").subarray(0, 40);
    expect(() => audioDurationMs(cut, "audio/webm")).not.toThrow();
    expect(audioDurationMs(Buffer.from([0x1a, 0x45, 0xdf, 0xa3, 0, 0, 0]), "audio/webm")).toBeNull();
    expect(audioDurationMs(Buffer.from("0000ftypjunk"), "audio/mp4")).toBeNull();
  });
});
