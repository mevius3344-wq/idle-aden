"use strict";
const fs = require("fs");
const path = require("path");
const dir = path.join(__dirname, "api", "[...path]");
fs.mkdirSync(dir, { recursive: true });
const body = `"use strict";

const { routeRequest } = require("../../lib/api-router");

module.exports = async (req, res) => {
  const url = req.url || "/";
  const pathname = url.split("?")[0];
  await routeRequest(req, res, pathname);
};
`;
fs.writeFileSync(path.join(dir, "index.js"), body);
console.log("ok", fs.readdirSync(path.join(__dirname, "api")));
console.log("catch", fs.readdirSync(dir));
