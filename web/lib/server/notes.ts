import "server-only";
import { randomUUID } from "node:crypto";
import type pg from "pg";
import { CONSENT_TEXT_VERSION } from "@/lib/consent";
import { config } from "./config";
import { db } from "./db";
import { encrypt } from "./envelope";
import { DELETE_TOKEN_PATTERN, hashDeleteToken, newDeleteToken, newPublicId } from "./ids";
import { getStorage } from "./storage";
import type { Submission } from "./submission";

/**
 * Saves a checked submission: the audio is encrypted with its own key, put in private
 * storage, and the note row is written. Returns the deletion token. It is shown to the
 * sender once and never stored, only its salted hash (invariant 5).
 */
export async function createNote(submission: Submission): Promise<{ token: string }> {
  const token = newDeleteToken();
  const audioKey = `raw/${randomUUID()}`;
  const storage = getStorage();

  await storage.put(audioKey, encrypt(submission.audio, config.masterKey));
  try {
    await db().query(
      `INSERT INTO notes (
         public_id, delete_token_hash, status, mode, prompt_id, duration_ms, source_tag,
         consent_store, consent_publish, consent_edit, consent_text_version,
         voice_choice, wait_choice, raw_audio_key, raw_audio_mime
       ) VALUES (
         $1, $2, 'received', $3,
         CASE WHEN $4::boolean THEN (SELECT id FROM prompts WHERE state = 'current' ORDER BY week_start DESC LIMIT 1) END,
         $5, $6, true, true, true, $7, $8, $9, $10, $11
       )`,
      [
        newPublicId(),
        hashDeleteToken(token, config.tokenSalt),
        submission.mode,
        submission.usesWeeklyPrompt,
        submission.durationMs,
        submission.sourceTag,
        CONSENT_TEXT_VERSION,
        submission.voice,
        submission.wait,
        audioKey,
        submission.mime,
      ],
    );
  } catch (error) {
    await storage.delete(audioKey).catch(() => {});
    throw error;
  }
  return { token };
}

/** What the deletion page can tell the sender. */
export type NoteStatus = "waiting" | "shared" | "deleted";

function statusFor(row: { status: string }): NoteStatus {
  if (row.status === "deleted") return "deleted";
  if (row.status === "live") return "shared";
  return "waiting";
}

function tokenHash(token: string): string | null {
  return DELETE_TOKEN_PATTERN.test(token) ? hashDeleteToken(token, config.tokenSalt) : null;
}

export async function findNoteStatus(token: string): Promise<NoteStatus | null> {
  const hash = tokenHash(token);
  if (!hash) return null;
  const { rows } = await db().query("SELECT status FROM notes WHERE delete_token_hash = $1", [hash]);
  return rows[0] ? statusFor(rows[0]) : null;
}

/**
 * Spec 6, "every transition to deleted": remove the audio and every text, keep the row
 * as a tombstone (id, status, timestamps), and write the deletion log (no content).
 * Placements (and their takedown tasks) arrive in M5.
 */
export async function deleteNoteBySender(token: string): Promise<NoteStatus | null> {
  const hash = tokenHash(token);
  if (!hash) return null;
  const client = await db().connect();
  try {
    await client.query("BEGIN");
    const { rows } = await client.query(
      "SELECT id, status, raw_audio_key, published_audio_key FROM notes WHERE delete_token_hash = $1 FOR UPDATE",
      [hash],
    );
    const note = rows[0];
    if (!note) {
      await client.query("ROLLBACK");
      return null;
    }
    if (note.status !== "deleted") {
      await deleteFiles(note);
      await tombstone(client, note.id);
      await client.query(
        "INSERT INTO deletion_log (actor, had_placements, action) VALUES ('sender', '{}', 'deleted_by_sender')",
      );
    }
    await client.query("COMMIT");
    return "deleted";
  } catch (error) {
    await client.query("ROLLBACK").catch(() => {});
    throw error;
  } finally {
    client.release();
  }
}

async function deleteFiles(note: { raw_audio_key: string | null; published_audio_key: string | null }) {
  const storage = getStorage();
  for (const key of [note.raw_audio_key, note.published_audio_key]) {
    if (key) await storage.delete(key);
  }
}

async function tombstone(client: pg.PoolClient, id: string) {
  await client.query(
    `UPDATE notes SET
       status = 'deleted', deleted_at = now(), expires_at = NULL,
       source_tag = NULL, prompt_id = NULL, language = NULL,
       raw_audio_key = NULL, raw_audio_mime = NULL, raw_transcript_enc = NULL,
       classifier_output = NULL, redacted_transcript = NULL, redaction_spans = NULL,
       translation = NULL, themes = NULL, published_audio_key = NULL, narrator_voice_id = NULL
     WHERE id = $1`,
    [id],
  );
}
