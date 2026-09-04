"use strict";

const { spawnSync } = require("node:child_process");
const path = require("node:path");

/**
 * `docker run --env-file` keeps surrounding quotes. Compose strips them.
 * Normalize both so DATABASE_URL / Redis / S3 URLs parse correctly.
 */
for (const key of Object.keys(process.env)) {
  const value = process.env[key];
  if (!value || value.length < 2) continue;
  const quote = value[0];
  if ((quote === '"' || quote === "'") && value.endsWith(quote)) {
    process.env[key] = value.slice(1, -1);
  }
}

const app = (process.env.APP || "sales").trim();
const allowed = new Set(["sales", "admin", "customer", "reception"]);
if (!allowed.has(app)) {
  console.error(`[boot] invalid APP="${app}" — expected sales|admin|customer|reception`);
  process.exit(1);
}

console.info(`[boot] docker-start — bootstrap then Next.js (${app})`);
const bootstrap = path.join(__dirname, "docker-bootstrap.cjs");
const result = spawnSync(process.execPath, [bootstrap], {
  stdio: "inherit",
  env: process.env,
});
if (result.error) {
  console.error("[bootstrap] failed to start:", result.error.message);
  process.exit(1);
}
if (result.status !== 0) {
  process.exit(result.status ?? 1);
}

require(`./apps/${app}/server.js`);
