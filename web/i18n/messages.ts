import type { AbstractIntlMessages } from "next-intl";

/** Drops the `__TODO` notes (for people, never shown) before messages go to the browser. */
export function withoutNotes(messages: AbstractIntlMessages): AbstractIntlMessages {
  return Object.fromEntries(
    Object.entries(messages)
      .filter(([key]) => !key.endsWith("__TODO"))
      .map(([key, value]) => [key, typeof value === "string" ? value : withoutNotes(value)]),
  );
}
