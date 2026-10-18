import { describe, expect, it } from "vitest";
import en from "@/messages/en.json";
import fr from "@/messages/fr.json";

type Tree = { [key: string]: string | Tree };

function flatten(tree: Tree, prefix = ""): Record<string, string> {
  return Object.entries(tree).reduce<Record<string, string>>((flat, [key, value]) => {
    const path = prefix ? `${prefix}.${key}` : key;
    return typeof value === "string" ? { ...flat, [path]: value } : { ...flat, ...flatten(value, path) };
  }, {});
}

// Keys ending in __TODO are notes for people (TODO(copy), TODO(copy-fr)), never shown.
const shown = (tree: Tree) => Object.entries(flatten(tree)).filter(([key]) => !key.endsWith("__TODO"));

describe("message files (spec 9.5)", () => {
  it("have the same keys in English and French", () => {
    expect(shown(fr).map(([key]) => key)).toEqual(shown(en).map(([key]) => key));
  });

  it("have no empty strings", () => {
    for (const [key, value] of [...shown(en), ...shown(fr)]) {
      expect(value.trim(), key).not.toBe("");
    }
  });

  it('never say "anonymous" (invariant 8)', () => {
    for (const [key, value] of [...shown(en), ...shown(fr)]) {
      expect(value.toLowerCase(), key).not.toMatch(/anonym/);
    }
  });

  it("only use __TODO notes for keys that exist", () => {
    for (const tree of [en, fr]) {
      const keys = Object.keys(flatten(tree));
      for (const key of keys.filter((k) => k.endsWith("__TODO"))) {
        expect(keys, key).toContain(key.replace(/__TODO$/, ""));
      }
    }
  });
});
