import test from "node:test";
import assert from "node:assert/strict";
import { Factory } from "../scripts/data/factory.js";
import { migrateData } from "../scripts/data/migrations.js";
import { normalizeProfile } from "../scripts/data/normalizer.js";
import { validateProfile } from "../scripts/data/validator.js";
import { snapToStep, safeImagePath } from "../scripts/utils/object.js";
import { summarize } from "../scripts/services/summary-service.js";
import { HistoryService } from "../scripts/services/history-service.js";
import { exportProfile, importProfile } from "../scripts/services/backup-service.js";
import { AUDIO_CUES, AUDIO_CUE_CATALOG } from "../scripts/core/audio-registry.js";
import { AudioService } from "../scripts/services/audio-service.js";
import { Repository } from "../scripts/services/repository.js";

test("factory uses the stable schema-2 defaults", () => {
  const data = Factory.defaults();
  assert.equal(data.schemaVersion, 2);
  assert.equal(data.revision, 1);
  assert.deepEqual(data.body.partOrder, ["head", "neck", "torso", "abdomen", "back", "leftArm", "rightArm", "leftHand", "rightHand", "leftLeg", "rightLeg", "leftFoot", "rightFoot"]);
  assert.equal(data.emotional.axes.mood.value, 70);
  assert.equal(data.emotional.axes.loneliness.value, 20);
  assert.equal(data.temperature.normalMax, 37.2);
  assert.equal(data.ui.lastSelectedAt, null);
  assert.equal(data.needs.standard.hygiene.enabled, false);
});

test("schema-1 migration adds back and is idempotent", () => {
  const source = Factory.defaults();
  delete source.body.parts.back;
  source.schemaVersion = 1;
  const migrated = migrateData(source);
  assert.equal(migrated.sourceSchema, 1);
  assert.ok(migrated.data.body.parts.back);
  assert.deepEqual(migrateData(migrated.data).data.body.partOrder, migrated.data.body.partOrder);
});

test("repository prefers module flag and falls back to legacy", () => {
  const legacy = Factory.defaults({ name: "Legacy" });
  const journal = { getFlag: (scope, key) => scope === "world" ? legacy : null };
  const repository = new Repository();
  assert.equal(repository.resolveCurrentOrLegacy(journal).legacy, true);
  assert.equal(repository.load(journal).data.profile.name, "Legacy");
  const current = Factory.defaults({ name: "Current" });
  const both = { getFlag: (scope, key) => scope === "world" ? legacy : current };
  assert.equal(repository.resolveCurrentOrLegacy(both).legacy, false);
  assert.equal(repository.load(both).data.profile.name, "Current");
});

test("future schema is preserved read-only", () => {
  const source = Factory.defaults();
  source.schemaVersion = 99;
  const result = migrateData(source);
  assert.equal(result.future, true);
  assert.equal(result.data.schemaVersion, 99);
  assert.equal(normalizeProfile(source).schemaVersion, 2);
});

test("normalizer preserves unknown fields and repairs metrics", () => {
  const source = Factory.defaults();
  source.extra = { pluginValue: true };
  source.body.parts.torso.value = "42";
  source.body.parts.torso.notes = "x";
  source.body.parts.torso.injuries = [{ id: "same", name: "A" }, { id: "same", name: "B" }];
  source.body.parts.torso.injuries[0].presentationKey = "not-real";
  const normalized = normalizeProfile(source);
  assert.equal(normalized.extra.pluginValue, true);
  assert.equal(normalized.body.parts.torso.value, 42);
  assert.equal(normalized.body.parts.torso.notes, "x");
  assert.notEqual(normalized.body.parts.torso.injuries[0].id, normalized.body.parts.torso.injuries[1].id);
  assert.equal(normalized.body.parts.torso.injuries[0].presentationKey, null);
  validateProfile(normalized);
});

test("incompatible structured containers are rejected", () => {
  const source = Factory.defaults();
  source.body.parts = [];
  assert.throws(() => normalizeProfile(source), /body.parts/);
  assert.throws(() => validateProfile(source));
});

test("metric snapping and image URL policy are deterministic", () => {
  assert.equal(snapToStep(36.66, 0.1, 0), 36.7);
  assert.equal(safeImagePath("javascript:alert(1)"), "");
  assert.equal(safeImagePath("icons/a.png"), "icons/a.png");
  assert.match(safeImagePath("data:image/png;base64,AAAA"), /^data:image/);
});

test("summary includes body deviations, injuries, needs and temperature", () => {
  const data = Factory.defaults();
  data.body.parts.head.value = 20;
  data.body.parts.torso.injuries.push({ id: "i", name: "Cut", severity: 4, active: true });
  data.needs.standard.thirst.value = 80;
  data.temperature.value = 39;
  const result = summarize(data);
  assert.ok(result.problems.some(problem => problem.kind === "part"));
  assert.ok(result.problems.some(problem => problem.kind === "injury"));
  assert.ok(result.problems.some(problem => problem.kind === "need"));
  assert.ok(result.problems.some(problem => problem.kind === "temperature"));
});

test("history is newest-first, filterable and maps dirty pages", () => {
  const history = [
    { timestamp: "2024-01-01T00:00:00Z", category: "body", label: "Old", reason: "x" },
    { timestamp: "2024-01-02T00:00:00Z", category: "mental", label: "New", reason: "stress" }
  ];
  assert.equal(HistoryService.sorted(history)[0].label, "New");
  assert.equal(HistoryService.filter(history, { query: "stress" }).length, 1);
  assert.ok(HistoryService.dirtyFor("body").includes("physical"));
});

test("backup round-trip retains normalized profile", () => {
  const source = Factory.defaults({ name: "Backup" });
  const result = importProfile(JSON.stringify(exportProfile(source)));
  assert.equal(result.data.profile.name, "Backup");
  assert.equal(result.data.schemaVersion, 2);
});

test("backup rejects future formats and oversized payloads", () => {
  assert.throws(() => importProfile(JSON.stringify({ exportFormat: "cst-profile-backup", exportVersion: 999, data: {} })), /Newer backup format/);
  assert.throws(() => importProfile("{" + `\"notes\":\"${"x".repeat(10 * 1024 * 1024)}\"` + "}"), /10 MiB/);
});

test("registered audio cues are local OGG paths", () => {
  assert.equal(Object.keys(AUDIO_CUE_CATALOG).length, 30);
  assert.ok(Object.keys(AUDIO_CUES).length >= 10);
  assert.ok(Object.values(AUDIO_CUES).every(path => path.startsWith("assets/audio/") && path.endsWith(".ogg")));
});

test("audio service ignores unknown cues and applies cooldown", async () => {
  const previousGame = globalThis.game; const previousHelper = globalThis.AudioHelper; let calls = 0;
  globalThis.game = { settings: { get: (_module, key) => ({ enableSfx: true, muteSfx: false, sfxVolume: 0.3, broadcastSfx: false }[key]) } };
  globalThis.AudioHelper = { play: async () => { calls += 1; return { stop() {} }; } };
  AudioService.last.clear();
  assert.equal(await AudioService.playCue("missing"), false);
  assert.ok(await AudioService.playCue("hungerDeep", { cooldown: 5000 }));
  assert.equal(await AudioService.playCue("hungerDeep", { cooldown: 5000 }), false);
  assert.equal(calls, 1);
  globalThis.game = previousGame; globalThis.AudioHelper = previousHelper;
});
