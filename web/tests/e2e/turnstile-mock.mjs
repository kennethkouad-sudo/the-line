// Stands in for Cloudflare's token check during browser tests, so tests don't depend on
// Cloudflare being reachable. It accepts only the test token, with the test secret.
import { createServer } from "node:http";

const port = Number(process.argv[2] ?? 3101);
const SECRET = "1x0000000000000000000000000000000AA";
const TOKEN = "XXXX.DUMMY.TOKEN.XXXX";

createServer((request, response) => {
  if (request.url === "/health") return response.end("ok");
  let body = "";
  request.on("data", (chunk) => (body += chunk));
  request.on("end", () => {
    const form = new URLSearchParams(body);
    const success = form.get("secret") === SECRET && form.get("response") === TOKEN;
    response.setHeader("content-type", "application/json");
    response.end(JSON.stringify({ success }));
  });
}).listen(port);
