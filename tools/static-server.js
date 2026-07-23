import { createReadStream, statSync } from "node:fs";
import { createServer } from "node:http";
import { extname, join, normalize, resolve, sep } from "node:path";

const root = resolve(process.cwd());
const port = Number(process.argv[2] || process.env.PORT || 8000);
const host = process.env.HOST || "127.0.0.1";

const MIME = {
  ".css": "text/css; charset=utf-8",
  ".gif": "image/gif",
  ".html": "text/html; charset=utf-8",
  ".ico": "image/x-icon",
  ".jpg": "image/jpeg",
  ".jpeg": "image/jpeg",
  ".js": "text/javascript; charset=utf-8",
  ".json": "application/json; charset=utf-8",
  ".mp3": "audio/mpeg",
  ".png": "image/png",
  ".svg": "image/svg+xml",
  ".txt": "text/plain; charset=utf-8",
  ".webmanifest": "application/manifest+json; charset=utf-8",
  ".woff": "font/woff",
  ".woff2": "font/woff2"
};

function send(response, status, headers = {}, body = "") {
  response.writeHead(status, headers);
  response.end(body);
}

function safePath(url) {
  try {
    const pathname = decodeURIComponent(new URL(url, `http://${host}:${port}`).pathname);
    const cleaned = normalize(pathname).replace(/^(\.\.[/\\])+/, "").replace(/^[/\\]+/, "");
    const filePath = resolve(join(root, cleaned || "index.html"));
    if (filePath !== root && !filePath.startsWith(`${root}${sep}`)) return null;
    return filePath;
  } catch (error) {
    return null;
  }
}

function parseRange(header, size) {
  const match = /^bytes=(\d*)-(\d*)$/.exec(header || "");
  if (!match) return null;
  const startText = match[1];
  const endText = match[2];
  let start = startText ? Number(startText) : 0;
  let end = endText ? Number(endText) : size - 1;
  if (!startText && endText) {
    const suffixLength = Number(endText);
    start = Math.max(size - suffixLength, 0);
    end = size - 1;
  }
  if (!Number.isInteger(start) || !Number.isInteger(end) || start < 0 || end < start || start >= size) return null;
  return { start, end: Math.min(end, size - 1) };
}

function serveFile(request, response, filePath, fileStat) {
  const type = MIME[extname(filePath).toLowerCase()] || "application/octet-stream";
  const common = {
    "Accept-Ranges": "bytes",
    "Cache-Control": "no-cache",
    "Content-Type": type
  };
  const range = parseRange(request.headers.range, fileStat.size);
  if (request.headers.range && !range) {
    send(response, 416, { ...common, "Content-Range": `bytes */${fileStat.size}` });
    return;
  }
  if (!range) {
    const headers = { ...common, "Content-Length": fileStat.size };
    response.writeHead(200, headers);
    if (request.method === "HEAD") {
      response.end();
      return;
    }
    createReadStream(filePath).pipe(response);
    return;
  }
  const length = range.end - range.start + 1;
  const headers = {
    ...common,
    "Content-Length": length,
    "Content-Range": `bytes ${range.start}-${range.end}/${fileStat.size}`
  };
  response.writeHead(206, headers);
  if (request.method === "HEAD") {
    response.end();
    return;
  }
  createReadStream(filePath, range).pipe(response);
}

const server = createServer((request, response) => {
  if (!["GET", "HEAD"].includes(request.method || "")) {
    send(response, 405, { Allow: "GET, HEAD" }, "Method not allowed");
    return;
  }
  let filePath = safePath(request.url || "/");
  if (!filePath) {
    send(response, 403, {}, "Forbidden");
    return;
  }
  try {
    let fileStat;
    try {
      fileStat = statSync(filePath);
    } catch (error) {
      if (extname(filePath)) throw error;
      filePath = `${filePath}.html`;
      fileStat = statSync(filePath);
    }
    if (fileStat.isDirectory()) {
      filePath = join(filePath, "index.html");
      fileStat = statSync(filePath);
    }
    serveFile(request, response, filePath, fileStat);
  } catch (error) {
    send(response, 404, {}, "Not found");
  }
});

server.listen(port, host, () => {
  console.log(`LitOverlay dev server: http://${host}:${port}/`);
});
