"use client";

import { useEffect } from "react";
import { SOURCE_TAG_STORAGE_KEY, sanitizeSourceTag } from "@/lib/sourceTag";

/**
 * Keeps the landing page's `?from=` tag in sessionStorage until submit (spec section 4).
 * The first valid tag of the session is kept; invalid tags are dropped.
 */
export function SourceTagCapture() {
  useEffect(() => {
    const tag = sanitizeSourceTag(new URLSearchParams(window.location.search).get("from"));
    if (!tag) return;
    try {
      if (!sessionStorage.getItem(SOURCE_TAG_STORAGE_KEY)) {
        sessionStorage.setItem(SOURCE_TAG_STORAGE_KEY, tag);
      }
    } catch {
      // Storage can be blocked (private mode, in-app browsers). The tag is optional.
    }
  }, []);

  return null;
}
