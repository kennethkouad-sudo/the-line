import { createHmac } from "node:crypto";
import type pg from "pg";

/**
 * Spec 5 and 7: 3 notes a day per connection. The IP address is never stored: only
 * HMAC(IP, a secret that changes every day), kept for 24 hours, never linked to a note.
 */
export const NOTES_PER_DAY = 3;

export function dailySecret(secret: string, now: Date): string {
  return createHmac("sha256", secret).update(now.toISOString().slice(0, 10)).digest("hex");
}

export function rateLimitKey(ip: string, secret: string, now: Date): string {
  return createHmac("sha256", dailySecret(secret, now)).update(ip).digest("hex");
}

/**
 * The visitor's IP, as seen by the last proxy in front of us (Clever Cloud's), which
 * appends it to X-Forwarded-For. Earlier entries can be forged by the visitor.
 */
export function clientIp(headers: Headers): string {
  const forwarded = headers.get("x-forwarded-for");
  const last = forwarded?.split(",").at(-1)?.trim();
  return last || headers.get("x-real-ip") || "unknown";
}

/** Counts one use. Returns false, and counts nothing, once the limit is reached. */
export async function takeRateLimit(
  client: pg.Pool | pg.PoolClient,
  key: string,
  bucket: string,
  limit: number,
): Promise<boolean> {
  await client.query("DELETE FROM rate_limits WHERE expires_at < now()");
  const result = await client.query(
    `INSERT INTO rate_limits (key, bucket, count, expires_at)
     VALUES ($1, $2, 1, now() + interval '24 hours')
     ON CONFLICT (key, bucket) DO UPDATE SET count = rate_limits.count + 1
     WHERE rate_limits.count < $3
     RETURNING count`,
    [key, bucket, limit],
  );
  return result.rowCount === 1;
}

/** Undoes takeRateLimit when the note couldn't be saved after all. */
export async function giveBackRateLimit(client: pg.Pool | pg.PoolClient, key: string, bucket: string) {
  await client.query("UPDATE rate_limits SET count = count - 1 WHERE key = $1 AND bucket = $2 AND count > 0", [
    key,
    bucket,
  ]);
}
