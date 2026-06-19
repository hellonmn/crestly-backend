#!/usr/bin/env node
/**
 * Cross-environment runner for dev-tool CLIs (tsc, nest, prisma).
 *
 * Why this exists — Hostinger's Node.js build sandbox has two quirks that
 * break the normal ways of invoking these CLIs:
 *   1. node_modules/.bin shims are installed WITHOUT the executable bit, so
 *      running `tsc` / `nest` directly fails with "Permission denied" (126).
 *   2. The source is built in `.../public_html/.builds/source/...` while the
 *      real node_modules lives at `.../public_html/node_modules`, reachable
 *      only via the PATH that npm injects — NOT via the real directory tree.
 *      So `require('typescript')` (which walks the real path) throws
 *      MODULE_NOT_FOUND.
 *
 * Fix: npm always adds the correct `node_modules/.bin` directories to PATH
 * when running a script. We derive each `node_modules` dir from those PATH
 * entries, find the requested package file inside one of them, and execute it
 * IN-PROCESS via require() — which only needs read access, not the exec bit.
 *
 * Usage: node <path>/run-bin.js <pkg/relative/entry.js> [args passed to it...]
 *   e.g. node ../../scripts/run-bin.js typescript/lib/tsc.js
 *        node ../../scripts/run-bin.js prisma/build/index.js generate
 *        node ../../scripts/run-bin.js @nestjs/cli/bin/nest.js build
 */
"use strict";
const fs = require("fs");
const path = require("path");

const target = process.argv[2];
if (!target) {
  console.error("run-bin: missing target module path");
  process.exit(1);
}
const forwardArgs = process.argv.slice(3);

// node_modules dirs derived from the .bin entries npm put on PATH.
const nmFromPath = (process.env.PATH || "")
  .split(path.delimiter)
  .map((p) => p.replace(/[\\/]+$/, ""))
  .filter((p) => /node_modules[\\/]\.bin$/i.test(p))
  .map((p) => path.dirname(p)); // .../node_modules/.bin -> .../node_modules

// Fallback search roots: cwd upward, and this script's own node_modules.
const fallbackRoots = [];
let dir = process.cwd();
while (true) {
  fallbackRoots.push(path.join(dir, "node_modules"));
  const parent = path.dirname(dir);
  if (parent === dir) break;
  dir = parent;
}
fallbackRoots.push(path.join(__dirname, "..", "node_modules"));

const candidates = [...nmFromPath, ...fallbackRoots];
let resolved = null;
for (const nm of candidates) {
  const candidate = path.join(nm, target);
  if (fs.existsSync(candidate)) {
    resolved = candidate;
    break;
  }
}

if (!resolved) {
  // Last resort: standard resolution (works in a normal layout).
  try {
    resolved = require.resolve(target);
  } catch {
    console.error(
      `run-bin: could not locate "${target}" in any node_modules.\n` +
        `Searched:\n  ${candidates.join("\n  ")}`
    );
    process.exit(1);
  }
}

// Present argv as if the tool were invoked directly: [node, toolEntry, ...args]
process.argv = [process.argv[0], resolved, ...forwardArgs];
require(resolved);
