import test from "node:test";
import assert from "node:assert/strict";
import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..");
const read = relative => fs.readFileSync(path.join(root, relative), "utf8");
const manifest = JSON.parse(read("module.json"));

test("v12 manifest identity and URLs are isolated from the v14 release", () => {
  assert.equal(manifest.id, "character-state-tracker");
  assert.equal(manifest.version, "1.0.0");
  assert.deepEqual(manifest.compatibility, { minimum: "12", verified: "12", maximum: "12" });
  assert.equal(manifest.manifest, "https://raw.githubusercontent.com/RudySimp/character-state-tracker/foundry-v12/module.json");
  assert.equal(manifest.download, "https://github.com/RudySimp/character-state-tracker/releases/download/v1.0.0-fvtt12/character-state-tracker-v12.zip");
  assert.match(manifest.readme, /blob\/foundry-v12\/README[.]md$/);
  assert.match(manifest.changelog, /blob\/foundry-v12\/CHANGELOG[.]md$/);
});

test("storage, schema and backup identity remain shared with v14", () => {
  const constants = read("scripts/core/constants.js");
  assert.match(constants, /SCHEMA_VERSION\s*=\s*2/);
  assert.match(constants, /MODULE_ID\s*=\s*"character-state-tracker"/);
  assert.match(constants, /DATA_KEY\s*=\s*"characterStateTracker"/);
  assert.match(constants, /PAGE_KEY\s*=\s*"characterStateTrackerPage"/);
  assert.match(constants, /BACKUP_FORMAT\s*=\s*"cst-profile-backup"/);
  assert.match(constants, /BACKUP_FORMAT_VERSION\s*=\s*2/);
});

test("production application uses documented v12 dialog APIs", () => {
  const source = read("scripts/applications/character-state-app.js");
  assert.match(source, /DialogV2[.]prompt/);
  assert.match(source, /DialogV2[.]confirm/);
  assert.doesNotMatch(source, /DialogV2[.]input/);
});

test("every template action has a registered ApplicationV2 handler", () => {
  const source = read("scripts/applications/character-state-app.js");
  const template = read("templates/character-state-app.hbs");
  const actions = new Set([...template.matchAll(/data-action="([^"]+)"/g)].map(match => match[1]));
  for (const action of actions) assert.ok(source.includes(`"${action}"`), `missing handler: ${action}`);
});

test("v12 runtime media set is complete", () => {
  const assets = path.join(root, "assets");
  const files = [];
  const walk = directory => fs.readdirSync(directory, { withFileTypes: true }).forEach(entry => entry.isDirectory() ? walk(path.join(directory, entry.name)) : files.push(path.join(directory, entry.name)));
  walk(assets);
  assert.equal(files.filter(file => file.endsWith(".png")).length, 54);
  assert.equal(files.filter(file => file.endsWith(".ogg")).length, 30);
  assert.equal(files.filter(file => /[.](?:wav|rar|zip|7z)$/i.test(file)).length, 0);
});
