import { createServer, type IncomingHttpHeaders } from "node:http";
import type { AddressInfo } from "node:net";
import { afterAll, beforeAll, describe, expect, it } from "vitest";
import { S3Storage } from "@/lib/server/storage";

// A pretend S3 server that records what it receives. Cellar (staging) refuses uploads
// without a Content-Length (411 MissingContentLength), so that header is checked here.
const seen: { method?: string; url?: string; headers: IncomingHttpHeaders; body: Buffer }[] = [];
const server = createServer((request, response) => {
  const chunks: Buffer[] = [];
  request.on("data", (chunk) => chunks.push(chunk));
  request.on("end", () => {
    const body = Buffer.concat(chunks);
    seen.push({ method: request.method, url: request.url, headers: request.headers, body });
    if (request.headers["content-length"] === undefined && request.method === "PUT") {
      response.statusCode = 411;
      return response.end("<Error><Code>MissingContentLength</Code></Error>");
    }
    response.end(request.method === "GET" ? "stored bytes" : "");
  });
});

let storage: S3Storage;
beforeAll(async () => {
  await new Promise<void>((resolve) => server.listen(0, "127.0.0.1", resolve));
  const { port } = server.address() as AddressInfo;
  storage = new S3Storage({
    endpoint: `http://127.0.0.1:${port}`,
    bucket: "the-line-staging-raw",
    accessKeyId: "test-key-id",
    secretAccessKey: "test-secret",
    region: "us-east-1",
  });
});
afterAll(() => server.close());

describe("S3 storage (Cellar)", () => {
  it("uploads with a Content-Length, signed, to the bucket path", async () => {
    const data = Buffer.from("TL1 encrypted bytes");
    await storage.put("raw/1234-abcd", data);
    const put = seen.at(-1)!;
    expect(put.method).toBe("PUT");
    expect(put.url).toBe("/the-line-staging-raw/raw/1234-abcd");
    expect(put.headers["content-length"]).toBe(String(data.length));
    expect(put.headers["transfer-encoding"]).toBeUndefined();
    expect(put.headers.authorization).toMatch(/^AWS4-HMAC-SHA256 Credential=test-key-id\//);
    expect(put.body.equals(data)).toBe(true);
  });

  it("reads and deletes", async () => {
    expect((await storage.get("raw/1234-abcd")).toString()).toBe("stored bytes");
    await storage.delete("raw/1234-abcd");
    expect(seen.at(-1)!.method).toBe("DELETE");
  });
});
