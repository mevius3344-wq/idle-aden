"use strict";

const { routeRequest } = require("../lib/api-router");

module.exports = async (req, res) => {
  const url = req.url || "/";
  const pathname = url.split("?")[0];
  await routeRequest(req, res, pathname);
};
