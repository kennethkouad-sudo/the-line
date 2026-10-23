import { config } from "@/lib/server/config";
import { db } from "@/lib/server/db";
import { createNote } from "@/lib/server/notes";
import { clientIp, NOTES_PER_DAY, rateLimitKey, takeRateLimit } from "@/lib/server/rateLimit";
import { MAX_BYTES, parseSubmission, type SubmissionError } from "@/lib/server/submission";
import { verifyTurnstile } from "@/lib/server/turnstile";

const STATUS: Record<SubmissionError, number> = {
  bad_request: 400,
  consent_missing: 400,
  bad_type: 415,
  too_large: 413,
  too_short: 422,
  too_long: 422,
  bot_check: 403,
  rate_limited: 429,
  server_error: 500,
};

const fail = (error: SubmissionError) =>
  Response.json({ error }, { status: STATUS[error], headers: { "cache-control": "no-store" } });

/**
 * Spec 7, step 1: the upload. Checks run cheapest-first, and nothing is stored until
 * every one has passed. The response carries the deletion token, once.
 */
export async function POST(request: Request) {
  try {
    const length = Number(request.headers.get("content-length"));
    if (length > MAX_BYTES + 64 * 1024) return fail("too_large");

    let form: FormData;
    try {
      form = await request.formData();
    } catch {
      return fail("bad_request");
    }

    if (!(await verifyTurnstile(form.get("cf-turnstile-response") as string | null))) return fail("bot_check");

    const parsed = await parseSubmission(form);
    if (!parsed.ok) return fail(parsed.error);

    const key = rateLimitKey(clientIp(request.headers), config.rateLimitSecret, new Date());
    if (!(await takeRateLimit(db(), key, "notes", NOTES_PER_DAY))) return fail("rate_limited");

    const { token } = await createNote(parsed.submission);
    const base = config.publicBaseUrl ?? new URL(request.url).origin;
    return Response.json(
      { token, deleteUrl: `${base.replace(/\/$/, "")}/d/${token}` },
      { status: 201, headers: { "cache-control": "no-store" } },
    );
  } catch (error) {
    // Never log the request itself: it carries the recording.
    console.error("upload failed:", error instanceof Error ? error.message : "unknown error");
    return fail("server_error");
  }
}
