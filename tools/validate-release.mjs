import fs from "node:fs";
import path from "node:path";
import { fileURLToPath, pathToFileURL } from "node:url";

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..");
const errors = [];
const warnings = [];
const read = relative => fs.readFileSync(path.join(root, relative), "utf8");
const exists = relative => fs.existsSync(path.join(root, relative));
const json = relative => JSON.parse(read(relative));
const add = (condition, message) => { if (!condition) errors.push(message); };

const manifest = json("module.json");
add(manifest.id === "character-state-tracker", "module id must be character-state-tracker");
add(manifest.type === "module", "manifest type must be module");
add(manifest.version === "1.0.0", "module version must be 1.0.0");
add(String(manifest.compatibility?.minimum) === "14", "minimum Foundry version must be 14");
add(String(manifest.compatibility?.verified) === "14", "verified Foundry version must be 14");
add(Array.isArray(manifest.esmodules) && manifest.esmodules.length === 1, "manifest must have one entry module");
add(Array.isArray(manifest.styles) && manifest.styles.length > 0, "manifest must include styles");
for (const relative of [...(manifest.esmodules ?? []), ...(manifest.styles ?? []), ...(manifest.languages ?? []).map(language => language.path)]) add(exists(relative), `manifest file missing: ${relative}`);
add(String(manifest.download ?? "").endsWith(`v${manifest.version}/character-state-tracker.zip`), "download URL must match version");
add(String(manifest.manifest ?? "").endsWith("/module.json"), "manifest URL must end in module.json");
add((manifest.media ?? []).every(media => media.type && media.url && exists(media.url)), "manifest media must point to existing files");

const en = json("lang/en.json");
const ru = json("lang/ru.json");
const enKeys = Object.keys(en).sort();
const ruKeys = Object.keys(ru).sort();
add(JSON.stringify(enKeys) === JSON.stringify(ruKeys), "localization key parity failed");
add([...enKeys, ...ruKeys].every(key => String(en[key] ?? ru[key]).trim().length > 0), "localization contains an empty value");

const appSource = read("scripts/applications/character-state-app.js");
const template = read("templates/character-state-app.hbs");
const actionNames = [...template.matchAll(/data-action="([^"]+)"/g)].map(match => match[1]);
for (const action of new Set(actionNames)) add(appSource.includes(`"${action}"`), `template action has no ApplicationV2 handler: ${action}`);
for (const token of ["ApplicationV2", "HandlebarsApplicationMixin", "DialogV2.input", "DialogV2.confirm", "onExternalUpdate", "onExternalDelete"]) add(appSource.includes(token), `application capability missing: ${token}`);
add(!/Coming soon|Not implemented|TODO|FIXME/i.test(template), "template contains placeholder text");

const runtimeFiles = [];
const assetFiles = [];
const walk = directory => { for (const entry of fs.readdirSync(directory, { withFileTypes: true })) { if ([".git", "node_modules", "dist", ".snapshot-audit"].includes(entry.name)) continue; const absolute = path.join(directory, entry.name); if (entry.isDirectory()) walk(absolute); else runtimeFiles.push(path.relative(root, absolute)); } };
walk(path.join(root, "scripts")); walk(path.join(root, "styles")); walk(path.join(root, "templates"));
const walkAssets = directory => { for (const entry of fs.readdirSync(directory, { withFileTypes: true })) { if (["_reference", "_rejected"].includes(entry.name)) continue; const absolute = path.join(directory, entry.name); if (entry.isDirectory()) walkAssets(absolute); else assetFiles.push(path.relative(root, absolute)); } };
walkAssets(path.join(root, "assets"));
for (const relative of runtimeFiles) { const source = read(relative); add(!/\b(?:TODO|FIXME|XXX)\b/.test(source), `unfinished marker in ${relative}`); }
const sourceText = runtimeFiles.map(read).join("\n");
add(!/flags\.world\s*=|update\(\s*\{[^}]*world\./s.test(sourceText), "runtime contains a direct world-flag write");
add(!/game\.settings\.set\([^,]+,\s*["'](?:data|profile)/.test(sourceText), "runtime contains an unsafe global setting write");
const localizedKeys = new Set([...sourceText, template].join("\n").matchAll(/CST\.[A-Za-z0-9_.]+/g));
for (const match of localizedKeys) if (!match[0].endsWith(".")) add(Object.hasOwn(en, match[0]), `missing localization key: ${match[0]}`);

// Resolve local named imports and execute the entry graph with a minimal v14 API stub.
const exportsByFile = new Map();
for (const relative of runtimeFiles.filter(file => file.endsWith(".js"))) {
  const source = read(relative); const names = new Set();
  for (const match of source.matchAll(/export\s+(?:async\s+)?(?:const|let|var|function|class)\s+([A-Za-z_$][\w$]*)/g)) names.add(match[1]);
  for (const match of source.matchAll(/export\s*\{([^}]+)\}/g)) for (const item of match[1].split(",")) names.add(item.trim().split(/\s+as\s+/).at(-1));
  if (source.includes("export default")) names.add("default"); exportsByFile.set(path.resolve(root, relative), names);
}
for (const relative of runtimeFiles.filter(file => file.endsWith(".js"))) {
  const source = read(relative); const importer = path.resolve(root, relative);
  for (const match of source.matchAll(/import\s*\{([^}]+)\}\s*from\s*["'](\.[^"']+)["']/g)) {
    let target = path.resolve(path.dirname(importer), match[2]); if (!target.endsWith(".js")) target += ".js";
    add(exportsByFile.has(target), `local import target missing: ${relative} -> ${match[2]}`);
    const exports = exportsByFile.get(target) ?? new Set();
    for (const item of match[1].split(",")) { const imported = item.trim().split(/\s+as\s+/)[0]; add(exports.has(imported), `named export ${imported} missing from ${match[2]} (imported by ${relative})`); }
  }
}
try {
  globalThis.Hooks = { once() {}, on() {} };
  globalThis.foundry = { applications: { api: { ApplicationV2: class {}, HandlebarsApplicationMixin: base => base, DialogV2: {} } } };
  await import(pathToFileURL(path.join(root, "scripts/main.js")));
} catch (error) { errors.push(`entry module graph failed: ${error.message}`); }

const { ASSETS } = await import(pathToFileURL(path.join(root, "scripts/core/asset-registry.js")));
const { AUDIO_CUES, AUDIO_CUE_CATALOG } = await import(pathToFileURL(path.join(root, "scripts/core/audio-registry.js")));
const flatten = value => Object.values(value).flatMap(item => typeof item === "string" ? [item] : flatten(item));
for (const relative of [...flatten(ASSETS), ...Object.values(AUDIO_CUES)]) add(exists(relative), `registered asset missing: ${relative}`);
add(Object.keys(AUDIO_CUE_CATALOG).length === 30, "audio catalog must contain 30 named cues");
const pngs = assetFiles.filter(relative => relative.toLowerCase().endsWith(".png"));
add(pngs.length >= 20, "runtime artwork is unexpectedly incomplete");
const audio = assetFiles.filter(relative => relative.toLowerCase().endsWith(".ogg"));
if (audio.length < 30) warnings.push(`only ${audio.length} OGG cues are present; the requested 30-cue audio set is incomplete`);
for (const relative of audio) add(fs.statSync(path.join(root, relative)).size > 256, `audio file is empty or suspiciously small: ${relative}`);
for (const relative of [...runtimeFiles, ...assetFiles]) add(!/[.]rar$|[.]zip$|[.]wav$/i.test(relative), `source archive/audio staging file in runtime: ${relative}`);

for (const required of ["README.md", "README_EN.md", "CHANGELOG.md", "RELEASE_NOTES_1.0.0.md", "docs/ASSET_MAP.md", "tests/data.test.mjs"]) add(exists(required), `required project file missing: ${required}`);
if (errors.length) { console.error(errors.map(error => `ERROR: ${error}`).join("\n")); process.exit(1); }
for (const warning of warnings) console.warn(`WARNING: ${warning}`);
console.log(`release validation passed (${runtimeFiles.length} runtime source files, ${pngs.length} PNG, ${audio.length} OGG)`);
