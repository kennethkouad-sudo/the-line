// A small stand-in for Clever Cloud's Cellar (S3) during browser tests. Like Cellar, it
// refuses uploads without a Content-Length and requests without an AWS signature. Objects
// are kept as files under the folder given, so tests can inspect what was stored.
import { mkdirSync, readFileSync, rmSync, writeFileSync } from "node:fs";
import { createServer } from "node:http";
import path from "node:path";

const [port, bucket, folder] = [Number(process.argv[2]), process.argv[3], process.argv[4]];

const reply = (response, status, code = "") => {
  response.statusCode = status;
  response.end(code && `<Error><Code>${code}</Code></Error>`);
};

createServer((request, response) => {
  if (request.url === "/health") return response.end("ok");
  const chunks = [];
  request.on("data", (chunk) => chunks.push(chunk));
  request.on("end", () => {
    const [, name, ...rest] = decodeURIComponent(new URL(request.url, "http://x").pathname).split("/");
    const key = rest.join("/");
    if (!request.headers.authorization?.startsWith("AWS4-HMAC-SHA256 ")) return reply(response, 403, "AccessDenied");
    if (name !== bucket) return reply(response, 404, "NoSuchBucket");
    if (!/^[a-z0-9/-]+$/.test(key) || key.includes("..")) return reply(response, 400, "InvalidObjectName");
    const file = path.join(folder, key);
    try {
      if (request.method === "PUT") {
        if (request.headers["content-length"] === undefined) return reply(response, 411, "MissingContentLength");
        mkdirSync(path.dirname(file), { recursive: true });
        writeFileSync(file, Buffer.concat(chunks));
        return reply(response, 200);
      }
      if (request.method === "GET") return response.end(readFileSync(file));
      if (request.method === "DELETE") {
        rmSync(file, { force: true });
        return reply(response, 204);
      }
      reply(response, 405, "MethodNotAllowed");
    } catch {
      reply(response, 404, "NoSuchKey");
    }
  });
}).listen(port);
