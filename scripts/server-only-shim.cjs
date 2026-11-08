/**
 * Lets Node scripts (tsx) import server modules that start with
 * `import "server-only"`. That package throws outside Next.js on purpose;
 * here it resolves to an empty module instead.
 *
 *   tsx --require ./scripts/server-only-shim.cjs scripts/<script>.ts
 */
const Module = require("module");
const path = require("path");
const original = Module._resolveFilename;
const empty = path.join(__dirname, "empty-module.cjs");
Module._resolveFilename = function (request, ...rest) {
  if (request === "server-only" || request === "client-only") return empty;
  return original.call(this, request, ...rest);
};
