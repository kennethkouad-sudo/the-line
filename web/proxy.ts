import { timingSafeEqual } from "node:crypto";
import { NextResponse, type NextRequest } from "next/server";

/**
 * Staging only (decisions log): every page asks for a password (HTTP basic auth, from
 * STAGING_USER and STAGING_PASSWORD), and search engines are told not to index it.
 * If APP_ENV=staging but no password is set, staging stays closed.
 */
function same(a: string, b: string) {
  const left = Buffer.from(a);
  const right = Buffer.from(b);
  return left.length === right.length && timingSafeEqual(left, right);
}

function allowed(header: string | null, user: string, password: string) {
  if (!header?.startsWith("Basic ")) return false;
  const decoded = Buffer.from(header.slice(6), "base64").toString("utf8");
  const split = decoded.indexOf(":");
  if (split < 0) return false;
  // Check both, always, so the time taken doesn't hint at which one was wrong.
  const userOk = same(decoded.slice(0, split), user);
  const passwordOk = same(decoded.slice(split + 1), password);
  return userOk && passwordOk;
}

export function proxy(request: NextRequest) {
  if (process.env.APP_ENV !== "staging") return NextResponse.next();

  const noindex = { "X-Robots-Tag": "noindex, nofollow" };
  if (request.nextUrl.pathname === "/api/health") return NextResponse.next({ headers: noindex });

  const user = process.env.STAGING_USER;
  const password = process.env.STAGING_PASSWORD;
  if (!user || !password) {
    return new NextResponse("Staging is closed: no password is set.", { status: 503, headers: noindex });
  }
  if (!allowed(request.headers.get("authorization"), user, password)) {
    return new NextResponse("Password required.", {
      status: 401,
      headers: { ...noindex, "WWW-Authenticate": 'Basic realm="The Line staging", charset="UTF-8"' },
    });
  }
  const response = NextResponse.next();
  response.headers.set("X-Robots-Tag", "noindex, nofollow");
  return response;
}
