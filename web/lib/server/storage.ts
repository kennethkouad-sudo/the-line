import "server-only";
import { mkdir, readFile, rm, writeFile } from "node:fs/promises";
import path from "node:path";
import { AwsClient } from "aws4fetch";
import { config } from "./config";

/**
 * Private file storage for raw audio. Files arrive here already encrypted (envelope.ts).
 * Staging and production use an S3-compatible bucket (Clever Cloud Cellar, private).
 * Local development and tests use a folder on disk. No route ever serves these files.
 */
export interface Storage {
  put(key: string, data: Buffer): Promise<void>;
  get(key: string): Promise<Buffer>;
  delete(key: string): Promise<void>;
}

const SAFE_KEY = /^[a-z0-9/-]{1,200}$/;

function checkKey(key: string) {
  if (!SAFE_KEY.test(key) || key.includes("..")) throw new Error("Bad storage key");
}

export class FolderStorage implements Storage {
  constructor(private readonly root: string) {}

  private file(key: string) {
    checkKey(key);
    return path.join(this.root, key);
  }

  async put(key: string, data: Buffer) {
    const file = this.file(key);
    await mkdir(path.dirname(file), { recursive: true });
    await writeFile(file, data, { mode: 0o600 });
  }

  async get(key: string) {
    return readFile(this.file(key));
  }

  async delete(key: string) {
    await rm(this.file(key), { force: true });
  }
}

export class S3Storage implements Storage {
  private readonly client: AwsClient;

  constructor(private readonly s3: NonNullable<typeof config.s3>) {
    this.client = new AwsClient({
      accessKeyId: s3.accessKeyId,
      secretAccessKey: s3.secretAccessKey,
      service: "s3",
      region: s3.region,
    });
  }

  private url(key: string) {
    checkKey(key);
    return `${this.s3.endpoint}/${this.s3.bucket}/${key}`;
  }

  private async send(method: string, key: string, body?: Buffer) {
    const response = await this.client.fetch(this.url(key), {
      method,
      body: body ? new Uint8Array(body) : undefined,
      headers: body ? { "content-type": "application/octet-stream" } : undefined,
    });
    if (!response.ok && !(method === "DELETE" && response.status === 404)) {
      // S3 explains failures with a short code (e.g. NoSuchBucket); log it, never the body or keys.
      const code = /<Code>([A-Za-z]{1,64})<\/Code>/.exec(await response.text().catch(() => ""))?.[1];
      throw new Error(
        `Storage ${method} failed: ${response.status}${code ? ` ${code}` : ""} (${new URL(this.s3.endpoint).host})`,
      );
    }
    return response;
  }

  async put(key: string, data: Buffer) {
    await this.send("PUT", key, data);
  }

  async get(key: string) {
    return Buffer.from(await (await this.send("GET", key)).arrayBuffer());
  }

  async delete(key: string) {
    await this.send("DELETE", key);
  }
}

let storage: Storage | undefined;

export function getStorage(): Storage {
  if (storage) return storage;
  const s3 = config.s3;
  if (s3) return (storage = new S3Storage(s3));
  const dir = config.storageDir;
  if (dir) return (storage = new FolderStorage(dir));
  throw new Error("No storage configured: set S3_* (or the Cellar add-on), or STORAGE_DIR for local use");
}
