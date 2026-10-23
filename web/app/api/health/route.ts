/** For the host's health check. Says nothing about notes. */
export function GET() {
  return new Response("ok", { headers: { "cache-control": "no-store" } });
}
