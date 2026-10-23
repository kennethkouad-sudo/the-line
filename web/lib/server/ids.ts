import { createHmac, randomInt, timingSafeEqual } from "node:crypto";

const BASE62 = "0123456789ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz";

/** Uniformly random base62 (randomInt has no modulo bias). */
export function randomBase62(length: number): string {
  let out = "";
  for (let i = 0; i < length; i++) out += BASE62[randomInt(62)];
  return out;
}

/** Spec 4: 22 or more random base62 characters (~128 bits). 24 gives ~143 bits. */
export const DELETE_TOKEN_LENGTH = 24;
export const DELETE_TOKEN_PATTERN = /^[0-9A-Za-z]{22,64}$/;

export function newDeleteToken(): string {
  return randomBase62(DELETE_TOKEN_LENGTH);
}

/** Spec 4: a random 10-character base62 id for /n/, never sequential. */
export function newPublicId(): string {
  return randomBase62(10);
}

/** Spec 5: SHA-256 of the token, salted with a server secret (an HMAC). Only this is stored. */
export function hashDeleteToken(token: string, salt: string): string {
  return createHmac("sha256", salt).update(token).digest("hex");
}

export function safeEqual(a: string, b: string): boolean {
  const left = Buffer.from(a);
  const right = Buffer.from(b);
  return left.length === right.length && timingSafeEqual(left, right);
}
