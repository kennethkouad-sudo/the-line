import { sanitizeSourceTag } from "@/lib/sourceTag";
import { CONSENT_TEXT_VERSION } from "@/lib/consent";
import { audioDurationMs, sniffAudio, type AudioKind } from "./audioFile";

/** Spec 7: the upload rules. Everything here is checked before anything is stored. */
export const MAX_BYTES = 3 * 1024 * 1024;
export const MIN_MS = 5_000;
export const MAX_MS = 62_000; // 60 s plus a grace margin

export type SubmissionError =
  | "bad_request"
  | "consent_missing"
  | "bad_type"
  | "too_large"
  | "too_short"
  | "too_long"
  | "bot_check"
  | "rate_limited"
  | "server_error";

export type Submission = {
  audio: Buffer;
  mime: AudioKind;
  durationMs: number;
  mode: "confide" | "encourage";
  usesWeeklyPrompt: boolean;
  voice: "own" | "narrator";
  wait: "asap" | "three_days";
  sourceTag: string | null;
};

type Result = { ok: true; submission: Submission } | { ok: false; error: SubmissionError };

const oneOf = <T extends string>(value: FormDataEntryValue | null, options: readonly T[]): T | null =>
  typeof value === "string" && (options as readonly string[]).includes(value) ? (value as T) : null;

export async function parseSubmission(form: FormData): Promise<Result> {
  // Invariant 1 and spec 7: all three consents, the version the sender saw, and both choices.
  const consents = ["consent_store", "consent_publish", "consent_edit"].map((name) => form.get(name) === "yes");
  if (!consents.every(Boolean) || form.get("consent_text_version") !== CONSENT_TEXT_VERSION) {
    return { ok: false, error: "consent_missing" };
  }
  const voice = oneOf(form.get("voice"), ["own", "narrator"] as const);
  const wait = oneOf(form.get("wait"), ["asap", "three_days"] as const);
  const mode = oneOf(form.get("mode"), ["confide", "encourage"] as const);
  const prompt = oneOf(form.get("prompt"), ["weekly", "free"] as const);
  if (!voice || !wait || !mode || !prompt) return { ok: false, error: "bad_request" };

  const file = form.get("audio");
  if (!(file instanceof File)) return { ok: false, error: "bad_request" };
  if (file.size > MAX_BYTES) return { ok: false, error: "too_large" };
  const declared = file.type.split(";")[0].trim();
  if (declared !== "audio/webm" && declared !== "audio/mp4") return { ok: false, error: "bad_type" };

  const audio = Buffer.from(await file.arrayBuffer());
  const mime = sniffAudio(audio);
  if (mime !== declared) return { ok: false, error: "bad_type" };

  // The file's own length wins. If the container doesn't say, the browser's figure is
  // used, and ffmpeg checks it again in M2.
  const claimed = Number(form.get("duration_ms"));
  const durationMs = audioDurationMs(audio, mime) ?? (Number.isFinite(claimed) ? Math.round(claimed) : NaN);
  if (!(durationMs >= MIN_MS)) return { ok: false, error: "too_short" };
  if (durationMs > MAX_MS) return { ok: false, error: "too_long" };

  return {
    ok: true,
    submission: {
      audio,
      mime,
      durationMs,
      mode,
      // The weekly question belongs to "Say what's on your mind" only (decisions log).
      usesWeeklyPrompt: mode === "confide" && prompt === "weekly",
      voice,
      wait,
      sourceTag: sanitizeSourceTag(form.get("source_tag") as string | null),
    },
  };
}
