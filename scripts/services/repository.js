import { DATA_KEY, FOLDER_NAME, LEGACY_SCOPE, MODULE_ID, PAGE_KEY } from "../core/constants.js";
import { Factory } from "../data/factory.js";
import { migrateData } from "../data/migrations.js";
import { normalizeProfile } from "../data/normalizer.js";
import { validateProfile } from "../data/validator.js";
import { clone } from "../utils/object.js";
import { HistoryService } from "./history-service.js";
import { localize } from "../core/localization.js";

export class CSTConflictError extends Error {
  constructor(message, details = {}) { super(message); this.name = "CSTConflictError"; this.details = details; }
}

export class Repository {
  constructor() { this.queues = new Map(); this.markers = new Set(); }
  getFlag(journal) { return journal?.getFlag(MODULE_ID, DATA_KEY) ?? null; }
  getLegacyFlag(journal) { return journal?.getFlag(LEGACY_SCOPE, DATA_KEY) ?? null; }
  loadRaw(journal) { return this.getFlag(journal) ?? this.getLegacyFlag(journal); }
  resolveCurrentOrLegacy(journal) {
    const current = this.getFlag(journal); if (current) return { raw: current, scope: MODULE_ID, legacy: false };
    const legacy = this.getLegacyFlag(journal); if (legacy) return { raw: legacy, scope: LEGACY_SCOPE, legacy: true };
    return { raw: null, scope: null, legacy: false };
  }
  load(journal) {
    const resolved = this.resolveCurrentOrLegacy(journal); if (!resolved.raw) return null;
    const migrated = migrateData(resolved.raw);
    const data = migrated.future ? clone(migrated.data) : normalizeProfile(migrated.data);
    return { ...migrated, data, legacy: resolved.legacy, scope: resolved.scope };
  }
  async ensureFolder() {
    let folder = game.folders?.find(item => item.type === "JournalEntry" && item.name === FOLDER_NAME);
    if (!folder && game.user?.isGM) folder = await Folder.create({ name: FOLDER_NAME, type: "JournalEntry" });
    return folder;
  }
  async findAll({ includeArchived = true } = {}) {
    return (game.journal?.contents ?? []).filter(journal => {
      const loaded = this.load(journal); return loaded && (includeArchived || !loaded.data.profile.archived);
    });
  }
  async createProfile(profile = {}) {
    if (!game.user?.isGM) throw new Error("GM permission required");
    const data = Factory.defaults(profile); validateProfile(data);
    const folder = await this.ensureFolder();
    return JournalEntry.create({ name: `${localize("CST.JournalPrefix")} - ${data.profile.name}`, folder: folder?.id, flags: { [MODULE_ID]: { [DATA_KEY]: data } } });
  }
  async _write(journal, data, expectedRevision) {
    const latestRaw = this.getFlag(journal); const latestRevision = Number(latestRaw?.revision ?? 0);
    if (latestRaw && latestRevision !== Number(expectedRevision)) throw new CSTConflictError("Profile changed on another client", { expectedRevision, latestRevision });
    const normalized = normalizeProfile(data); validateProfile(normalized);
    normalized.revision = Math.max(Number(expectedRevision), Number(normalized.revision), 1) + 1;
    normalized.profile.updatedAt = new Date().toISOString();
    const options = { cstInternal: true };
    this.markers.add(journal.id);
    try { await journal.setFlag(MODULE_ID, DATA_KEY, normalized, options); } finally { this.markers.delete(journal.id); }
    return normalized;
  }
  async setFlag(journal, data) {
    const loaded = this.load(journal); if (!loaded || loaded.future) throw new Error("Profile is unavailable or read-only");
    return this._write(journal, data, Number(loaded.data.revision ?? 1));
  }
  async saveMutation(journal, operation, { maxRetries = 2 } = {}) {
    if (!game.user?.isGM) throw new Error("GM permission required");
    let lastError;
    for (let attempt = 0; attempt <= maxRetries; attempt++) {
      const loaded = this.load(journal); if (!loaded || loaded.future) throw new Error("Profile is unavailable or read-only");
      const baseRevision = Number(loaded.data.revision ?? 1); const next = clone(loaded.data); const result = await operation(next, loaded.data);
      try { return await this._write(journal, result ?? next, baseRevision); }
      catch (error) { if (!(error instanceof CSTConflictError) || attempt === maxRetries) throw error; lastError = error; }
    }
    throw lastError;
  }
  async mutate(journal, operation, options = {}) {
    const key = journal.id; const previous = this.queues.get(key) ?? Promise.resolve();
    const next = previous.catch(() => {}).then(() => this.saveMutation(journal, operation, options));
    this.queues.set(key, next); next.finally(() => { if (this.queues.get(key) === next) this.queues.delete(key); });
    return next;
  }
  async saveUI(journal, patch) {
    if (!game.user?.isGM) return false;
    const latest = this.load(journal); if (!latest || latest.future) return false;
    await this.mutate(journal, data => { data.ui = { ...data.ui, ...patch, lastSelectedAt: new Date().toISOString() }; return data; });
    return true;
  }
  async migrateLegacy(journal) {
    if (!game.user?.isGM) throw new Error("GM permission required");
    const loaded = this.load(journal); if (!loaded?.legacy) return false; validateProfile(loaded.data);
    const migrated = clone(loaded.data);
    migrated.history.push(HistoryService.event({ category: "system", action: "migration", label: localize("CST.History.Migrated"), reason: "world flag to module flag" }));
    await this._write(journal, migrated, Number(migrated.revision ?? 1) - 1);
    return true;
  }
  async archive(journal, archived = true) { return this.mutate(journal, data => { data.profile.archived = archived; return data; }); }
  async renameJournal(journal, name) { if (!game.user?.isGM) throw new Error("GM permission required"); this.markers.add(journal.id); try { return await journal.update({ name: String(name).slice(0, 150) }, { cstInternal: true }); } finally { this.markers.delete(journal.id); } }
  isInternal(journal) { return this.markers.has(journal?.id); }
  async flush() { await Promise.all(this.queues.values()); }
  async deleteProfile(journal) { if (!game.user?.isGM) throw new Error("GM permission required"); await this.flush(); return journal.delete({ cstInternal: true }); }
  pageMap(journal) { const map = new Map(); for (const page of journal?.pages?.contents ?? []) { const role = page.getFlag(MODULE_ID, PAGE_KEY)?.role; if (role && !map.has(role)) map.set(role, page); } return map; }
  async ensurePages(journal, data) { const { pageService } = await import("./journal-page-service.js"); return pageService.ensurePages(journal, data); }
  async repair(journal) { const loaded = this.load(journal); if (!loaded || loaded.future) return { dirtyPages: [] }; const { pageService } = await import("./journal-page-service.js"); return pageService.repairPages(journal, loaded.data); }
}
export const repository = new Repository();
