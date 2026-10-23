import "server-only";
import { config } from "./config";

/**
 * Spec 7: the Cloudflare Turnstile token is checked before anything else is read.
 * Fails closed: no secret configured, a network error or a bad answer all mean "no".
 * Only the token and our secret are sent; not the visitor's IP.
 */
export async function verifyTurnstile(token: string | null): Promise<boolean> {
  const secret = config.turnstileSecret;
  if (!secret || !token || token.length > 2048) return false;
  try {
    const response = await fetch(config.turnstileVerifyUrl, {
      method: "POST",
      body: new URLSearchParams({ secret, response: token }),
      signal: AbortSignal.timeout(10_000),
    });
    if (!response.ok) return false;
    const result = (await response.json()) as { success?: boolean };
    return result.success === true;
  } catch {
    return false;
  }
}
