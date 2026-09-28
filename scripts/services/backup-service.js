import { BACKUP_FORMAT, BACKUP_FORMAT_VERSION, MAX_IMPORT_BYTES } from "../core/constants.js";
import { migrateData } from "../data/migrations.js";
import { normalizeProfile } from "../data/normalizer.js";
import { validateProfile } from "../data/validator.js";

export function exportProfile(data, notes = "") {
  return { exportFormat: BACKUP_FORMAT, exportVersion: BACKUP_FORMAT_VERSION, schemaVersion: data.schemaVersion, exportedAt: new Date().toISOString(), data, notes: String(notes).slice(0, 10000) };
}

export function importProfile(text) {
  const sourceText = typeof text === "string" ? text : JSON.stringify(text);
  if (new Blob([sourceText]).size > MAX_IMPORT_BYTES) throw new Error("Backup exceeds 10 MiB");
  const raw = typeof text === "string" ? JSON.parse(text) : text;
  if (!raw || typeof raw !== "object" || Array.isArray(raw)) throw new Error("Backup must be an object");
  if (raw.exportFormat === BACKUP_FORMAT && Number(raw.exportVersion ?? 1) > BACKUP_FORMAT_VERSION) throw new Error("Newer backup format is unsupported");
  const candidate = raw.exportFormat === BACKUP_FORMAT ? raw.data : raw;
  const migrated = migrateData(candidate);
  if (migrated.future) throw new Error("Newer schema cannot be imported");
  const data = normalizeProfile(migrated.data);
  validateProfile(data);
  return { data, notes: String(raw.notes ?? "").slice(0, 10000), sourceSchema: migrated.sourceSchema };
}

export function downloadBackup(payload, name = "character-state-tracker-backup.json") {
  const safeName = `${String(name).replace(/[\\/:*?"<>|\u0000-\u001f]/g, "_").slice(0, 120) || "character-state-tracker-backup"}.json`.replace(/\.json\.json$/i, ".json");
  const blob = new Blob([JSON.stringify(payload, null, 2)], { type: "application/json" });
  const url = URL.createObjectURL(blob); const anchor = document.createElement("a"); anchor.href = url; anchor.download = safeName; anchor.click(); setTimeout(() => URL.revokeObjectURL(url), 0);
}
