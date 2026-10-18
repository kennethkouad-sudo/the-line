import { describe, expect, it } from "vitest";
import { sanitizeSourceTag } from "@/lib/sourceTag";

describe("sanitizeSourceTag (spec section 4)", () => {
  it.each(["intro", "nl-25oct", "car-1022", "reel-1014", "a", "x".repeat(32)])("keeps %s", (tag) => {
    expect(sanitizeSourceTag(tag)).toBe(tag);
  });

  it.each([
    ["empty", ""],
    ["missing", null],
    ["uppercase", "Intro"],
    ["spaces", "my tag"],
    ["underscore", "nl_25"],
    ["too long", "x".repeat(33)],
    ["accent", "été"],
    ["markup", "<script>"],
  ])("drops %s", (_label, tag) => {
    expect(sanitizeSourceTag(tag)).toBeNull();
  });
});
