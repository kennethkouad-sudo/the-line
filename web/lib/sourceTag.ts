// Spec section 4: `?from=<tag>`, lowercase [a-z0-9-]{1,32}; anything else is dropped.
const SOURCE_TAG = /^[a-z0-9-]{1,32}$/;

export const SOURCE_TAG_STORAGE_KEY = "line.source_tag";

export function sanitizeSourceTag(raw: string | null | undefined): string | null {
  return raw && SOURCE_TAG.test(raw) ? raw : null;
}
