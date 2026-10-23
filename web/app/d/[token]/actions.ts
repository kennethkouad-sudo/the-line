"use server";

import { deleteNoteBySender } from "@/lib/server/notes";

/** Deletes the note for this token. Final: the audio is removed and only a tombstone stays. */
export async function deleteNote(token: string): Promise<{ ok: boolean }> {
  try {
    return { ok: (await deleteNoteBySender(token)) === "deleted" };
  } catch (error) {
    console.error("deletion failed:", error instanceof Error ? error.message : "unknown error");
    return { ok: false };
  }
}
