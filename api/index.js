"use strict";

const { routeRequest } = require("../lib/api-router");

/**
 * All /api/* traffic is rewritten to /api?__p=… so multi-segment routes
 * (e.g. /api/econ/status) work on Vercel where catch-all files only match one segment.
 */
function resolveApiPath(req) {
  try {
    const u = new URL(req.url || "/", "http://localhost");
    const p = u.searchParams.get("__p");
    if (p != null && p !== "") {
      return "/api/" + String(p).replace(/^\/+/, "");
    }
    if (p === "") return "/api";
  } catch (e) {}

  const h = req.headers || {};
  for (const key of ["x-forwarded-uri", "x-invoke-path", "x-vercel-forwarded-path"]) {
    const raw = h[key];
    if (!raw) continue;
    const pathOnly = String(raw).split("?")[0];
    if (pathOnly.startsWith("/api")) return pathOnly;
  }

  const fallback = String(req.url || "/api").split("?")[0];
  return fallback.startsWith("/api") ? fallback : "/api";
}

module.exports = async (req, res) => {
  await routeRequest(req, res, resolveApiPath(req));
};
