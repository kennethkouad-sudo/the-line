import { createCipheriv, createDecipheriv, randomBytes } from "node:crypto";

/**
 * Envelope encryption (spec 14, invariant 4). Each file gets its own random key; that key
 * is locked with the master key from the environment. Both use AES-256-GCM, which also
 * detects any tampering.
 *
 * Layout: "TL1" | wrapped-key iv (12) | wrapped key (32) | wrapped-key tag (16)
 *               | data iv (12) | data tag (16) | ciphertext
 */
const MAGIC = Buffer.from("TL1");
const IV = 12;
const TAG = 16;
const KEY = 32;

function seal(key: Buffer, plain: Buffer) {
  const iv = randomBytes(IV);
  const cipher = createCipheriv("aes-256-gcm", key, iv);
  const body = Buffer.concat([cipher.update(plain), cipher.final()]);
  return { iv, body, tag: cipher.getAuthTag() };
}

function open(key: Buffer, iv: Buffer, body: Buffer, tag: Buffer) {
  const decipher = createDecipheriv("aes-256-gcm", key, iv);
  decipher.setAuthTag(tag);
  return Buffer.concat([decipher.update(body), decipher.final()]);
}

export function encrypt(plain: Buffer, masterKey: Buffer): Buffer {
  const dataKey = randomBytes(KEY);
  const wrapped = seal(masterKey, dataKey);
  const data = seal(dataKey, plain);
  dataKey.fill(0);
  return Buffer.concat([MAGIC, wrapped.iv, wrapped.body, wrapped.tag, data.iv, data.tag, data.body]);
}

export function decrypt(sealed: Buffer, masterKey: Buffer): Buffer {
  if (!sealed.subarray(0, MAGIC.length).equals(MAGIC)) throw new Error("Not an encrypted file");
  let at = MAGIC.length;
  const take = (n: number) => sealed.subarray(at, (at += n));
  const wrappedIv = take(IV);
  const wrappedKey = take(KEY);
  const wrappedTag = take(TAG);
  const dataIv = take(IV);
  const dataTag = take(TAG);
  const dataKey = open(masterKey, wrappedIv, wrappedKey, wrappedTag);
  try {
    return open(dataKey, dataIv, sealed.subarray(at), dataTag);
  } finally {
    dataKey.fill(0);
  }
}
