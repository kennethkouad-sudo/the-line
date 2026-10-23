import "server-only";

/**
 * Every setting comes from the environment (spec 14, decisions log: the code stays portable).
 * Read lazily, so the app can be built without secrets. Clever Cloud's add-on variable
 * names are accepted as fallbacks, so its add-ons work without copying values around.
 */
function env(name: string, ...fallbacks: string[]): string | undefined {
  for (const key of [name, ...fallbacks]) {
    const value = process.env[key];
    if (value) return value;
  }
  return undefined;
}

function required(name: string, ...fallbacks: string[]): string {
  const value = env(name, ...fallbacks);
  if (!value) throw new Error(`${name} is not set`);
  return value;
}

export const config = {
  get databaseUrl() {
    return required("DATABASE_URL", "POSTGRESQL_ADDON_URI");
  },
  /** 32 random bytes, base64. Wraps each file's own key (spec 14). */
  get masterKey(): Buffer {
    const key = Buffer.from(required("MASTER_KEY"), "base64");
    if (key.length !== 32) throw new Error("MASTER_KEY must be 32 bytes, base64-encoded");
    return key;
  },
  get tokenSalt() {
    return required("TOKEN_SALT");
  },
  get rateLimitSecret() {
    return required("RATE_LIMIT_SECRET");
  },
  get turnstileSiteKey() {
    return env("TURNSTILE_SITE_KEY");
  },
  get turnstileSecret() {
    return env("TURNSTILE_SECRET");
  },
  get turnstileVerifyUrl() {
    return env("TURNSTILE_VERIFY_URL") ?? "https://challenges.cloudflare.com/turnstile/v0/siteverify";
  },
  get s3() {
    const host = env("S3_ENDPOINT", "CELLAR_ADDON_HOST");
    if (!host) return undefined;
    return {
      endpoint: host.startsWith("http") ? host : `https://${host}`,
      bucket: required("S3_BUCKET"),
      accessKeyId: required("S3_ACCESS_KEY_ID", "CELLAR_ADDON_KEY_ID"),
      secretAccessKey: required("S3_SECRET_ACCESS_KEY", "CELLAR_ADDON_KEY_SECRET"),
      region: env("S3_REGION") ?? "us-east-1",
    };
  },
  /** Local development and tests only: raw audio goes to this folder, still encrypted. */
  get storageDir() {
    return env("STORAGE_DIR");
  },
  get isStaging() {
    return process.env.APP_ENV === "staging";
  },
  get publicBaseUrl() {
    return env("PUBLIC_BASE_URL");
  },
};
