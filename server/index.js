"use strict";
const http = require("http");
const fs = require("fs");
const path = require("path");

const ROOT = path.join(__dirname, "..");
const PORT = Number(process.env.PORT || 5173);
const HOST = process.env.HOST || "0.0.0.0";

const MIME = {
  ".html": "text/html; charset=utf-8",
  ".css": "text/css; charset=utf-8",
  ".js": "text/javascript; charset=utf-8",
  ".png": "image/png",
  ".jpg": "image/jpeg",
  ".jpeg": "image/jpeg",
  ".webp": "image/webp",
  ".gif": "image/gif",
  ".json": "application/json; charset=utf-8",
  ".ico": "image/x-icon",
  ".svg": "image/svg+xml",
  ".woff2": "font/woff2",
};

function send(res, status, body, type = "text/plain; charset=utf-8") {
  res.writeHead(status, { "Content-Type": type, "Cache-Control": "no-store" });
  res.end(body);
}

function safePath(urlPath) {
  const clean = decodeURIComponent((urlPath || "/").split("?")[0]);
  const rel = clean === "/" ? "index.html" : clean.replace(/^\/+/, "");
  const full = path.normalize(path.join(ROOT, rel));
  if (!full.startsWith(ROOT)) return null;
  return full;
}

const server = http.createServer((req, res) => {
  if (req.method !== "GET" && req.method !== "HEAD") {
    return send(res, 405, "Method Not Allowed");
  }
  const file = safePath(req.url);
  if (!file) return send(res, 403, "Forbidden");
  fs.readFile(file, (err, data) => {
    if (err) return send(res, 404, "Not Found");
    const ext = path.extname(file).toLowerCase();
    send(res, 200, data, MIME[ext] || "application/octet-stream");
  });
});

server.listen(PORT, HOST, () => {
  console.log(`blank server http://${HOST}:${PORT}`);
});
