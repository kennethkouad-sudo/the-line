// The settings the browser tests run the app with. Test values only; nothing real.
export const E2E_PORT = 3100;
export const TURNSTILE_MOCK_PORT = 3101;
export const S3_MOCK_PORT = 3102;

/** Where the Cellar stand-in (s3-mock.mjs) keeps what it's sent, so tests can look at it. */
export const STORED_FILES = ".storage/e2e";
export const S3_BUCKET = "the-line-e2e";

/** Cloudflare's published test site key, and the token our stand-in script hands out. */
export const TEST_SITE_KEY = "1x00000000000000000000AA";
export const TEST_BOT_TOKEN = "XXXX.DUMMY.TOKEN.XXXX";

export const E2E_ENV = {
  DATABASE_URL: process.env.E2E_DATABASE_URL ?? "postgres://the_line:local-dev-only@localhost:5432/the_line_test",
  // Saved through the same S3 code as staging (Cellar), to a strict local stand-in.
  S3_ENDPOINT: `http://localhost:${S3_MOCK_PORT}`,
  S3_BUCKET,
  S3_ACCESS_KEY_ID: "e2e-key-id",
  S3_SECRET_ACCESS_KEY: "e2e-secret",
  MASTER_KEY: Buffer.alloc(32, 7).toString("base64"),
  TOKEN_SALT: "e2e-token-salt",
  RATE_LIMIT_SECRET: "e2e-rate-limit-secret",
  TURNSTILE_SITE_KEY: TEST_SITE_KEY,
  TURNSTILE_SECRET: "1x0000000000000000000000000000000AA",
  TURNSTILE_VERIFY_URL: `http://localhost:${TURNSTILE_MOCK_PORT}/siteverify`,
};
