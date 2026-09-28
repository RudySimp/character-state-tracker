import { repository } from "../services/repository.js";
import { pageService } from "../services/journal-page-service.js";
import { summarize, buildSummaryText } from "../services/summary-service.js";
import { HistoryService } from "../services/history-service.js";
import { exportProfile, importProfile, downloadBackup } from "../services/backup-service.js";
import { inspectProfile } from "../services/diagnostics-service.js";
import { AudioService } from "../services/audio-service.js";
import { BODY_ORDER, BODY_NAMES, INJURY_PHASES } from "../core/constants.js";
import { localize } from "../core/localization.js";
import { clamp, randomId, escapeHtml } from "../utils/object.js";
import { ASSETS } from "../core/asset-registry.js";
import { PRESENTATION_KEYS } from "../core/presentation-registry.js";

const { ApplicationV2, HandlebarsApplicationMixin, DialogV2 } = foundry.applications.api;
const formValue = (formData, key) => formData?.get?.(key) ?? formData?.object?.[key] ?? formData?.[key];
const getPath = (root, path) => String(path).split(".").reduce((value, key) => value?.[key], root);
const setPath = (root, path, value) => { const keys = String(path).split("."); const field = keys.pop(); const parent = keys.reduce((entry, key) => entry?.[key], root); if (!parent || field === undefined) return false; parent[field] = value; return true; };
const categoryForPath = path => path.startsWith("body") ? "body" : path.startsWith("mental") ? "mental" : path.startsWith("emotional") ? "emotional" : path.startsWith("needs") ? "needs" : path.startsWith("temperature") ? "temperature" : "system";
const bodyStatus = value => value <= 0 ? "zero" : value <= 10 ? "near-zero" : value <= 30 ? "critical" : value <= 50 ? "serious" : value <= 70 ? "moderate" : value <= 85 ? "minor" : "normal";
const presetOptions = current => `<label>${localize("CST.VisualPreset")} <select name="presentationKey"><option value="">${localize("CST.PresetAutomatic")}</option>${PRESENTATION_KEYS.map(key => `<option value="${key}" ${key === current ? "selected" : ""}>${key}</option>`).join("")}</select></label>`;
const metricArt = (area, id) => area === "mental" ? ASSETS.mental[id] : area === "emotional" ? ASSETS.emotional[id] : area === "needs" ? (ASSETS.needs[id] ?? ASSETS.physiology[id]) : null;

export class CharacterStateApp extends HandlebarsApplicationMixin(ApplicationV2) {
  static DEFAULT_OPTIONS = {
    id: "character-state-tracker-app", classes: ["cst-app"], position: { width: 1180, height: 800 }, window: { resizable: true },
    actions: {
      "new-profile": this._newProfile, "select-profile": this._selectProfile, "set-section": this._setSection, "set-body-part": this._setBodyPart, "set-body-view": this._setBodyView,
      "metric-adjust": this._metricAdjust, "metric-absolute": this._metricAbsolute, "metric-number": this._metricAbsolute, "metric-range": this._metricAbsolute, "body-preset": this._bodyPreset, "toggle-setting": this._toggleSetting,
      "archive-profile": this._archiveProfile, "toggle-archive": this._toggleArchive, "restore-profile": this._restoreProfile, "delete-profile": this._deleteProfile, "open-journal": this._openJournal,
      "migrate-profile": this._migrateProfile, "repair-pages": this._repairPages, "restore-notes": this._restoreNotes, "export-json": this._exportJson, "import-json": this._importJson,
      "add-injury": this._addInjury, "edit-injury": this._editInjury, "archive-injury": this._archiveInjury, "restore-injury": this._restoreInjury,
      "add-condition": this._addCondition, "edit-condition": this._editCondition, "archive-condition": this._archiveCondition, "restore-condition": this._restoreCondition,
      "add-custom-axis": this._addCustomAxis, "edit-custom-axis": this._editCustomAxis, "add-custom-need": this._addCustomNeed, "edit-custom-need": this._editCustomNeed,
      "add-custom-state": this._addCustomState, "edit-custom-state": this._editCustomState, "archive-custom-state": this._archiveCustomState, "restore-custom-state": this._restoreCustomState,
      "history-load-more": this._historyLoadMore, "set-history-category": this._setHistoryCategory, "run-diagnostics": this._runDiagnostics, "open-notes": this._openNotes, "save-temperature-settings": this._saveTemperature,
      "save-profile-settings": this._saveProfileSettings, "use-actor-name": this._useActorName, "use-actor-image": this._useActorImage,
      "refresh-summary": this._refresh
    }
  };
  static PARTS = { main: { template: "modules/character-state-tracker/templates/character-state-app.hbs" } };

  constructor(options = {}) {
    super(options); this.journal = null; this.section = "body"; this.part = "torso"; this.bodyView = "front"; this.historyQuery = ""; this.historyCategory = "all"; this.historyPage = 1; this.busy = false; this.noteDrafts = new Map();
  }
  get selectedJournalId() { return this.journal?.id ?? null; }
  _draftKey(part = this.part) { return `${this.selectedJournalId}:${part}`; }
  async flushDrafts() {
    for (const [key, notes] of [...this.noteDrafts.entries()]) {
      const [journalId, part] = key.split(":"); const journal = game.journal?.get(journalId); if (!journal || !game.user?.isGM) continue;
      try { await repository.mutate(journal, data => { if (data.body.parts[part]) data.body.parts[part].notes = String(notes).slice(0, 10000); return data; }); this.noteDrafts.delete(key); } catch (_) { /* keep the draft for a later retry */ }
    }
  }
  _metricContext(data) {
    if (!data) return [];
    if (this.section === "mental" || this.section === "emotional") {
      const area = this.section;
      return [...Object.entries(data[area].axes).map(([id, metric]) => ({ ...metric, builtin: true, art: metricArt(area, id), path: `${area}.axes.${id}.value` })), ...data[area].customAxes.map((metric, index) => ({ ...metric, custom: true, customIndex: index, path: `${area}.customAxes.${index}.value` }))];
    }
    if (this.section === "needs") return [...Object.entries(data.needs.standard).map(([id, metric]) => ({ ...metric, builtin: true, art: metricArt("needs", id), path: `needs.standard.${id}.value` })), ...data.needs.custom.map((metric, index) => ({ ...metric, custom: true, customIndex: index, path: `needs.custom.${index}.value` }))];
    return [];
  }
  async _prepareContext() {
    const journals = await repository.findAll();
    if (!this.journal || !journals.some(journal => journal.id === this.journal.id)) this.journal = journals.find(journal => !repository.load(journal)?.data?.profile?.archived) ?? journals[0] ?? null;
    const loaded = this.journal ? repository.load(this.journal) : null; const data = loaded?.data ?? null;
    if (data) { this.section = data.ui.selectedSection || this.section; this.part = data.ui.selectedBodyPart || this.part; this.bodyView = data.ui.bodyView || this.bodyView; }
    const selectedPart = data?.body?.parts?.[this.part] ? { ...data.body.parts[this.part] } : null; const draft = this.noteDrafts.get(this._draftKey()); if (selectedPart && draft !== undefined) selectedPart.notes = draft;
    const summary = data ? summarize(data) : { problems: [], count: 0 }; const historyResult = data ? HistoryService.page(data.history, this.historyPage, { query: this.historyQuery, category: this.historyCategory }) : { items: [], hasMore: false };
    const selectedInjuries = selectedPart?.injuries ?? [];
    const mentalConditions = data ? data.mental.conditions : [];
    const emotionalConditions = data ? data.emotional.conditions : [];
    const customStates = data ? data.customStates : [];
    const ribbon = data ? [
      { key: "body", label: localize("CST.Ribbon.Physical"), value: `${data.body.overall.value}/100`, art: ASSETS.sections.body, status: data.body.overall.value < 31 ? "critical" : data.body.overall.value < 71 ? "warning" : "normal" },
      { key: "pain", label: localize("CST.Ribbon.Pain"), value: `${data.body.pain.value}/100`, art: ASSETS.sections.pain, status: data.body.pain.value >= 61 ? "critical" : data.body.pain.value >= 21 ? "warning" : "normal" },
      { key: "temperature", label: localize("CST.Ribbon.Temperature"), value: `${data.temperature.value}${data.temperature.unit}`, art: ASSETS.sections.temperature, status: data.temperature.value < data.temperature.normalMin || data.temperature.value > data.temperature.normalMax ? "warning" : "normal" },
      { key: "stress", label: data.mental.axes.stress.label, value: `${data.mental.axes.stress.value}${data.mental.axes.stress.unit}`, art: ASSETS.sections.mental, status: data.mental.axes.stress.value >= 61 ? "warning" : "normal" },
      { key: "hunger", label: data.needs.standard.hunger.label, value: `${data.needs.standard.hunger.value}${data.needs.standard.hunger.unit}`, art: ASSETS.physiology.hunger, status: data.needs.standard.hunger.value >= 61 ? "warning" : "normal" },
      { key: "thirst", label: data.needs.standard.thirst.label, value: `${data.needs.standard.thirst.value}${data.needs.standard.thirst.unit}`, art: ASSETS.physiology.thirst, status: data.needs.standard.thirst.value >= 61 ? "warning" : "normal" },
      { key: "sleep", label: data.needs.standard.sleep.label, value: `${data.needs.standard.sleep.value}${data.needs.standard.sleep.unit}`, art: ASSETS.physiology.sleep, status: data.needs.standard.sleep.value >= 61 ? "warning" : "normal" }
    ].filter(item => item.key === "body" ? data.config.physicalEnabled && data.body.overall.enabled : item.key === "pain" ? data.config.painEnabled && data.body.pain.enabled : item.key === "temperature" ? data.config.temperatureEnabled && data.temperature.enabled : item.key === "stress" ? data.config.mentalEnabled && data.mental.axes.stress.enabled : data.config.needsEnabled && data.needs.standard[item.key]?.enabled) : [];
    const sections = ["body", "mental", "emotional", "needs", "temperature", "summary", "history", "settings"].map(id => ({ id, label: localize(`CST.Section.${id}`), active: id === this.section, art: ASSETS.sections[id] ?? ASSETS.sections.overview }));
    return {
      empty: !data, data, loaded, isGM: Boolean(game.user?.isGM), busy: this.busy,
      journals: journals.map(journal => { const profile = repository.load(journal)?.data?.profile; return { id: journal.id, name: profile?.name ?? journal.name, archived: Boolean(profile?.archived), active: journal.id === this.journal?.id }; }),
      sections, presets: [100, 80, 60, 40, 20, 0], section: this.section, sectionLabel: localize(`CST.Section.${this.section}`), isBody: this.section === "body", isTemperature: this.section === "temperature", isSummary: this.section === "summary", isHistory: this.section === "history", isSettings: this.section === "settings",
      bodyParts: data ? BODY_ORDER.map(id => ({ id, name: data.body.parts[id]?.name ?? BODY_NAMES[id], value: data.body.parts[id]?.value ?? 100, status: bodyStatus(data.body.parts[id]?.value ?? 100), pain: data.body.parts[id]?.localPain ?? 0, injuries: data.body.parts[id]?.injuries?.filter(item => item.active).length ?? 0, active: id === this.part, disabled: data.body.parts[id]?.enabled === false })) : [],
      selectedPart, selectedPartArt: ASSETS.body[this.part] ?? ASSETS.sections.body, selectedPartStatus: selectedPart ? bodyStatus(selectedPart.value) : "normal", sectionArt: ASSETS.sections[this.section] ?? ASSETS.sections.overview, bodyView: this.bodyView, bodyFront: this.bodyView === "front", bodyBack: this.bodyView === "back", metrics: this._metricContext(data),
      problems: summary.problems.slice(0, 12), summaryText: data ? buildSummaryText(data) : "", history: historyResult.items, historyMore: historyResult.hasMore, historyQuery: this.historyQuery,
      historyCount: data?.history?.length ?? 0, historyWarning: (data?.history?.length ?? 0) >= 2000, ribbon,
      selectedInjuries, mentalConditions, emotionalConditions, customStates, temperature: data?.temperature,
      isMental: this.section === "mental", isEmotional: this.section === "emotional", isNeeds: this.section === "needs",
      hasLegacy: Boolean(loaded?.legacy), future: Boolean(loaded?.future), diagnostics: this.journal && data ? inspectProfile(this.journal) : null
    };
  }
  async _onRender() {
    this.element?.querySelectorAll("textarea[data-path]").forEach(input => { input.addEventListener("input", event => this.noteDrafts.set(this._draftKey(), event.currentTarget.value)); input.addEventListener("change", event => this._savePath(event.currentTarget.dataset.path, event.currentTarget.value)); });
    this.element?.querySelectorAll('input[data-action="metric-absolute"],input[data-action="metric-number"],input[data-action="metric-range"]').forEach(input => input.addEventListener("change", event => CharacterStateApp._metricAbsolute.call(this, event, event.currentTarget)));
    const search = this.element?.querySelector("[data-cst-history-search]"); search?.addEventListener("input", event => { clearTimeout(this._historyTimer); this._historyTimer = setTimeout(() => { this.historyQuery = event.target.value; this.historyPage = 1; this.render(); }, 180); });
  }
  async _savePath(path, value) { if (!this.journal || !game.user?.isGM) return; await repository.mutate(this.journal, data => { setPath(data, path, String(value).slice(0, 10000)); return data; }); this.noteDrafts.delete(this._draftKey()); await pageService.syncPages(this.journal, repository.load(this.journal).data, ["summary", "physical", "history"]); await this.render(); }
  async handleExternalUpdate(journalId) { if (journalId !== this.selectedJournalId) return; if (this.noteDrafts.has(this._draftKey())) { ui.notifications.warn(localize("CST.ExternalUpdateDraft")); return; } await this.render(); }
  async handleExternalDelete(journalId) { if (journalId !== this.selectedJournalId) return; this.journal = null; await this.render(); }

  static async _newProfile() {
    const formData = await DialogV2.input({ window: { title: localize("CST.NewProfile") }, content: `<label>${localize("CST.ProfileName")} <input name="name" required maxlength="150" value="${localize("CST.DefaultName")}"></label>`, ok: { label: localize("CST.CreateProfile") } });
    const name = String(formValue(formData, "name") ?? "").trim(); if (!name) return; this.journal = await repository.createProfile({ name }); await pageService.ensurePages(this.journal, repository.load(this.journal).data); await this.render({ force: true });
  }
  static async _selectProfile(_event, target) { await this.flushDrafts(); this.journal = game.journal.get(target.dataset.id); this.historyPage = 1; await this.render(); }
  static async _setSection(_event, target) { this.section = target.dataset.section; if (this.journal && game.user?.isGM) await repository.saveUI(this.journal, { selectedSection: this.section }); await this.render(); }
  static async _setBodyPart(_event, target) { await this.flushDrafts(); this.part = target.dataset.part; if (this.journal && game.user?.isGM) await repository.saveUI(this.journal, { selectedBodyPart: this.part }); await this.render(); }
  static async _setBodyView(_event, target) { this.bodyView = target.dataset.view; if (this.journal && game.user?.isGM) await repository.saveUI(this.journal, { bodyView: this.bodyView }); await this.render(); }
  static async _metricAdjust(_event, target) { await this._mutateMetric(target.dataset.path, value => value + Number(target.dataset.delta), this.element?.querySelector(`[data-reason-for="${target.dataset.path}"]`)?.value); }
  static async _metricAbsolute(_event, target) { await this._mutateMetric(target.dataset.path, () => Number(target.value), this.element?.querySelector(`[data-reason-for="${target.dataset.path}"]`)?.value); }
  static async _bodyPreset(_event, target) { await this._mutateMetric(`body.parts.${this.part}.value`, () => Number(target.dataset.value)); }
  static async _mutateMetric(path, transform, reason = "") {
    if (!this.journal || !game.user?.isGM || this.busy) return; const category = categoryForPath(path); let change = null; this.busy = true;
    try {
      await repository.mutate(this.journal, data => { const oldValue = Number(getPath(data, path)); if (!Number.isFinite(oldValue)) return data; const metric = getPath(data, path.split(".").slice(0, -1).join(".")); const minimum = Number.isFinite(Number(metric?.min)) ? Number(metric.min) : 0; const maximum = Number.isFinite(Number(metric?.max)) ? Number(metric.max) : 100; const newValue = clamp(transform(oldValue), minimum, maximum, oldValue); if (newValue === oldValue) return data; setPath(data, path, newValue); change = { oldValue, newValue }; data.history.push(HistoryService.event({ category, target: path, label: localize("CST.History.ValueChanged"), oldValue, newValue, reason: String(reason || "").slice(0, 500) })); return data; });
      if (!change) return; const reasonField = this.element?.querySelector(`[data-reason-for="${path}"]`); if (reasonField) reasonField.value = ""; const saved = repository.load(this.journal).data; await pageService.syncPages(this.journal, saved, HistoryService.dirtyFor(category)); await this._playMetricCue(path, change.oldValue, change.newValue);
    } finally { this.busy = false; await this.render(); }
  }
  async _playMetricCue(path, oldValue, newValue) { const enteredHigh = oldValue < 75 && newValue >= 75; const enteredLow = oldValue > 25 && newValue <= 25; const cue = path.includes("exhaustion") && enteredHigh ? "exhaustionDeep" : path.includes("stress") && enteredHigh ? "stressDeep" : path.includes("confusion") && enteredHigh ? "confusionDeep" : path.includes("hunger") && enteredHigh ? "hungerDeep" : path.includes("thirst") && enteredHigh ? "thirstDeep" : path.includes("temperature") && enteredLow ? "hypothermiaDeep" : path.includes("temperature") && enteredHigh ? "overheatDeep" : null; if (cue) await AudioService.playCue(cue); }
  static async _toggleSetting(_event, target) {
    if (!this.journal || !game.user?.isGM) return;
    const path = target.dataset.path;
    await repository.mutate(this.journal, data => {
      const current = getPath(data, path);
      if (typeof current === "boolean") {
        setPath(data, path, !current);
        data.history.push(HistoryService.event({ category: categoryForPath(path), action: "toggle", label: path, oldValue: current, newValue: !current }));
      }
      return data;
    });
    const saved = repository.load(this.journal).data;
    await pageService.syncPages(this.journal, saved, HistoryService.dirtyFor(categoryForPath(path)));
    await this.render();
  }
  static async _archiveProfile() { if (this.journal && await DialogV2.confirm({ content: localize("CST.ConfirmArchive") })) { await repository.archive(this.journal, true); await this.render(); } }
  static async _toggleArchive() { const archived = repository.load(this.journal)?.data?.profile?.archived; if (archived) return this._restoreProfile(); return this._archiveProfile(); }
  static async _restoreProfile() { if (this.journal) { await repository.archive(this.journal, false); await this.render(); } }
  static async _deleteProfile() { if (!this.journal || !game.user?.isGM) return; if (!await DialogV2.confirm({ content: localize("CST.ConfirmDelete") })) return; const formData = await DialogV2.input({ content: `<label>${localize("CST.TypeName")} <input name="name" required autocomplete="off"></label>`, ok: { label: localize("CST.Delete") } }); const expectedName = repository.load(this.journal)?.data?.profile?.name; if (String(formValue(formData, "name") ?? "") !== expectedName) { ui.notifications.warn(localize("CST.DeleteNameMismatch")); return; } await repository.deleteProfile(this.journal); this.journal = null; await this.render(); }
  static _openJournal() { this.journal?.sheet?.render(true); }
  static async _migrateProfile() { if (this.journal && await DialogV2.confirm({ content: localize("CST.ConfirmMigration") })) { await repository.migrateLegacy(this.journal); await pageService.ensurePages(this.journal, repository.load(this.journal).data); await this.render(); } }
  static async _repairPages() { if (!this.journal) return; await pageService.repairPages(this.journal, repository.load(this.journal).data); ui.notifications.info(localize("CST.PagesRepaired")); await this.render(); }
  static async _restoreNotes() { if (!this.journal) return; await pageService.restoreNotesPage(this.journal); ui.notifications.info(localize("CST.NotesRestored")); }
  static async _exportJson() { if (!this.journal) return; const data = repository.load(this.journal).data; downloadBackup(exportProfile(data), `${data.profile.name}.json`); }
  static async _importJson() {
    if (!this.journal || !game.user?.isGM) return; const input = document.createElement("input"); input.type = "file"; input.accept = ".json,application/json"; input.onchange = async () => { const file = input.files?.[0]; if (!file) return; try { const imported = importProfile(await file.text()); const target = repository.load(this.journal).data; imported.data.profile.id = target.profile.id; imported.data.profile.createdAt = target.profile.createdAt; imported.data.profile.archived = target.profile.archived; imported.data.profile.sort = target.profile.sort; imported.data.history.push(HistoryService.event({ category: "profile", action: "import", label: localize("CST.History.Imported") })); await repository.mutate(this.journal, () => imported.data); await pageService.ensurePages(this.journal, repository.load(this.journal).data); await this.render(); } catch (error) { ui.notifications.error(`${localize("CST.ImportFailed")}: ${error.message}`); } }; input.click();
  }
  static async _addInjury() {
    if (!this.journal || !game.user?.isGM) return; const formData = await DialogV2.input({ content: `<label>${localize("CST.InjuryName")} <input name="name" required maxlength="150"></label><label>${localize("CST.Severity")} <input name="severity" type="number" min="1" max="5" value="1"></label>${presetOptions("")}`, ok: { label: localize("CST.Add") } }); const name = String(formValue(formData, "name") ?? "").trim(); if (!name) return;
    await repository.mutate(this.journal, data => { const timestamp = new Date().toISOString(); data.body.parts[this.part].injuries.push({ id: randomId(), name, severity: clamp(formValue(formData, "severity"), 1, 5, 1), phase: INJURY_PHASES[0], description: "", consequences: "", presentationKey: PRESENTATION_KEYS.includes(formValue(formData, "presentationKey")) ? formValue(formData, "presentationKey") : null, createdAt: timestamp, updatedAt: timestamp, active: true }); data.history.push(HistoryService.event({ category: "injury", action: "create", label: name, newValue: this.part })); return data; }); await pageService.syncPages(this.journal, repository.load(this.journal).data, HistoryService.dirtyFor("injury")); await AudioService.playCue("injuryDeep"); await this.render();
  }
  static async _archiveInjury(_event, target) { await this._setInjuryActive(target.dataset.id, false); }
  static async _restoreInjury(_event, target) { await this._setInjuryActive(target.dataset.id, true); }
  static async _setInjuryActive(id, active) { if (!this.journal || !game.user?.isGM) return; await repository.mutate(this.journal, data => { const injury = data.body.parts[this.part].injuries.find(item => item.id === id); if (injury) { injury.active = active; injury.updatedAt = new Date().toISOString(); data.history.push(HistoryService.event({ category: "injury", action: active ? "restore" : "archive", label: injury.name })); } return data; }); await pageService.syncPages(this.journal, repository.load(this.journal).data, HistoryService.dirtyFor("injury")); await this.render(); }
  static async _editInjury(_event, target) {
    if (!this.journal || !game.user?.isGM) return;
    const current = repository.load(this.journal)?.data?.body?.parts?.[this.part]?.injuries?.find(item => item.id === target.dataset.id);
    if (!current) return;
    const content = `<label>${localize("CST.InjuryName")} <input name="name" required maxlength="150" value="${escapeHtml(current.name)}"></label><label>${localize("CST.Severity")} <input name="severity" type="number" min="1" max="5" value="${current.severity}"></label><label>${localize("CST.Phase")} <select name="phase">${INJURY_PHASES.map(phase => `<option value="${phase}" ${phase === current.phase ? "selected" : ""}>${phase}</option>`).join("")}</select></label><label>${localize("CST.Description")} <textarea name="description">${escapeHtml(current.description)}</textarea></label><label>${localize("CST.Consequences")} <textarea name="consequences">${escapeHtml(current.consequences)}</textarea></label>${presetOptions(current.presentationKey)}`;
    const formData = await DialogV2.input({ content, ok: { label: localize("CST.Save") } });
    if (!formData) return;
    await repository.mutate(this.journal, data => { const injury = data.body.parts[this.part].injuries.find(item => item.id === current.id); if (injury) { injury.name = String(formValue(formData, "name") ?? current.name).trim().slice(0, 150); injury.severity = clamp(formValue(formData, "severity"), 1, 5, current.severity); injury.phase = INJURY_PHASES.includes(formValue(formData, "phase")) ? formValue(formData, "phase") : current.phase; injury.description = String(formValue(formData, "description") ?? "").slice(0, 10000); injury.consequences = String(formValue(formData, "consequences") ?? "").slice(0, 10000); injury.presentationKey = PRESENTATION_KEYS.includes(formValue(formData, "presentationKey")) ? formValue(formData, "presentationKey") : null; injury.updatedAt = new Date().toISOString(); data.history.push(HistoryService.event({ category: "injury", action: "edit", label: injury.name })); } return data; });
    await pageService.syncPages(this.journal, repository.load(this.journal).data, HistoryService.dirtyFor("injury")); await this.render();
  }
  static async _addCondition(_event, target) {
    if (!this.journal || !game.user?.isGM) return;
    const area = target.dataset.area === "emotional" ? "emotional" : "mental";
    const formData = await DialogV2.input({ content: `<label>${localize("CST.ConditionName")} <input name="name" required maxlength="150"></label><label>${localize("CST.Intensity")} <input name="intensity" type="number" min="1" max="5" value="1"></label><label>${localize("CST.Source")} <input name="source" maxlength="500"></label><label>${localize("CST.Manifestation")} <textarea name="manifestation"></textarea></label><label>${localize("CST.Notes")} <textarea name="notes"></textarea></label>${presetOptions("")}`, ok: { label: localize("CST.Add") } });
    const name = String(formValue(formData, "name") ?? "").trim(); if (!name) return;
    await repository.mutate(this.journal, data => { const now = new Date().toISOString(); data[area].conditions.push({ id: randomId(), name, intensity: clamp(formValue(formData, "intensity"), 1, 5, 1), source: String(formValue(formData, "source") ?? "").slice(0, 500), manifestation: String(formValue(formData, "manifestation") ?? "").slice(0, 5000), notes: String(formValue(formData, "notes") ?? "").slice(0, 10000), presentationKey: PRESENTATION_KEYS.includes(formValue(formData, "presentationKey")) ? formValue(formData, "presentationKey") : null, createdAt: now, updatedAt: now, active: true }); data.history.push(HistoryService.event({ category: area, action: "condition-create", label: name })); return data; }); await pageService.syncPages(this.journal, repository.load(this.journal).data, HistoryService.dirtyFor(area)); await this.render();
  }
  static async _editCondition(_event, target) {
    if (!this.journal || !game.user?.isGM) return;
    const area = target.dataset.area === "emotional" ? "emotional" : "mental"; const current = repository.load(this.journal)?.data?.[area]?.conditions?.find(item => item.id === target.dataset.id); if (!current) return;
    const formData = await DialogV2.input({ content: `<label>${localize("CST.ConditionName")} <input name="name" required maxlength="150" value="${escapeHtml(current.name)}"></label><label>${localize("CST.Intensity")} <input name="intensity" type="number" min="1" max="5" value="${current.intensity}"></label><label>${localize("CST.Source")} <input name="source" value="${escapeHtml(current.source)}"></label><label>${localize("CST.Manifestation")} <textarea name="manifestation">${escapeHtml(current.manifestation)}</textarea></label><label>${localize("CST.Notes")} <textarea name="notes">${escapeHtml(current.notes)}</textarea></label>${presetOptions(current.presentationKey)}`, ok: { label: localize("CST.Save") } }); if (!formData) return;
    await repository.mutate(this.journal, data => { const item = data[area].conditions.find(entry => entry.id === current.id); if (item) { item.name = String(formValue(formData, "name") ?? item.name).trim().slice(0, 150); item.intensity = clamp(formValue(formData, "intensity"), 1, 5, item.intensity); item.source = String(formValue(formData, "source") ?? "").slice(0, 500); item.manifestation = String(formValue(formData, "manifestation") ?? "").slice(0, 5000); item.notes = String(formValue(formData, "notes") ?? "").slice(0, 10000); item.presentationKey = PRESENTATION_KEYS.includes(formValue(formData, "presentationKey")) ? formValue(formData, "presentationKey") : null; item.updatedAt = new Date().toISOString(); data.history.push(HistoryService.event({ category: area, action: "condition-edit", label: item.name })); } return data; }); await pageService.syncPages(this.journal, repository.load(this.journal).data, HistoryService.dirtyFor(area)); await this.render();
  }
  static async _setConditionActive(_event, target, active) { const area = target.dataset.area === "emotional" ? "emotional" : "mental"; if (!this.journal || !game.user?.isGM) return; await repository.mutate(this.journal, data => { const item = data[area].conditions.find(entry => entry.id === target.dataset.id); if (item) { item.active = active; item.updatedAt = new Date().toISOString(); data.history.push(HistoryService.event({ category: area, action: active ? "condition-restore" : "condition-archive", label: item.name })); } return data; }); await pageService.syncPages(this.journal, repository.load(this.journal).data, HistoryService.dirtyFor(area)); await this.render(); }
  static async _archiveCondition(event, target) { return this._setConditionActive(event, target, false); }
  static async _restoreCondition(event, target) { return this._setConditionActive(event, target, true); }
  static async _addCustomAxis(_event, target) { return this._promptCustomMetric(target.dataset.area === "emotional" ? "emotional" : "mental", false); }
  static async _editCustomAxis(_event, target) { return this._promptCustomMetric(target.dataset.area === "emotional" ? "emotional" : "mental", true, target.dataset.index); }
  static async _promptCustomMetric(area, edit, index) {
    if (!this.journal || !game.user?.isGM) return; const current = edit ? repository.load(this.journal)?.data?.[area]?.customAxes?.[Number(index)] : null;
    const formData = await DialogV2.input({ content: `<label>${localize("CST.MetricName")} <input name="label" required maxlength="150" value="${escapeHtml(current?.label ?? "")}"></label><label>${localize("CST.Value")} <input name="value" type="number" value="${current?.value ?? 0}"></label><label>${localize("CST.Direction")} <select name="direction"><option value="higher-is-worse">${localize("CST.HigherIsWorse")}</option><option value="higher-is-better">${localize("CST.HigherIsBetter")}</option></select></label>`, ok: { label: edit ? localize("CST.Save") : localize("CST.Add") } }); if (!formData) return;
    await repository.mutate(this.journal, data => { let metric = edit ? data[area].customAxes[Number(index)] : null; if (!metric) { metric = { id: randomId(), label: "", enabled: true, value: 0, min: 0, max: 100, step: 1, unit: "", direction: "higher-is-worse", minLabel: "", maxLabel: "" }; data[area].customAxes.push(metric); } metric.label = String(formValue(formData, "label") ?? metric.label).trim().slice(0, 150); metric.value = clamp(formValue(formData, "value"), metric.min, metric.max, metric.value); metric.direction = formValue(formData, "direction") === "higher-is-better" ? "higher-is-better" : "higher-is-worse"; data.history.push(HistoryService.event({ category: area, action: edit ? "axis-edit" : "axis-create", label: metric.label })); return data; }); await pageService.syncPages(this.journal, repository.load(this.journal).data, HistoryService.dirtyFor(area)); await this.render();
  }
  static async _addCustomNeed() { return this._promptCustomNeed(false); }
  static async _editCustomNeed(_event, target) { return this._promptCustomNeed(true, target.dataset.index); }
  static async _promptCustomNeed(edit, index) { if (!this.journal || !game.user?.isGM) return; const current = edit ? repository.load(this.journal)?.data?.needs?.custom?.[Number(index)] : null; const formData = await DialogV2.input({ content: `<label>${localize("CST.NeedName")} <input name="label" required maxlength="150" value="${escapeHtml(current?.label ?? "")}"></label><label>${localize("CST.Value")} <input name="value" type="number" value="${current?.value ?? 0}"></label>`, ok: { label: edit ? localize("CST.Save") : localize("CST.Add") } }); if (!formData) return; await repository.mutate(this.journal, data => { let metric = edit ? data.needs.custom[Number(index)] : null; if (!metric) { metric = { id: randomId(), label: "", enabled: true, value: 0, min: 0, max: 100, step: 1, unit: "", direction: "higher-is-worse", minLabel: "", maxLabel: "" }; data.needs.custom.push(metric); } metric.label = String(formValue(formData, "label") ?? metric.label).trim().slice(0, 150); metric.value = clamp(formValue(formData, "value"), metric.min, metric.max, metric.value); data.history.push(HistoryService.event({ category: "needs", action: edit ? "custom-need-edit" : "custom-need-create", label: metric.label })); return data; }); await pageService.syncPages(this.journal, repository.load(this.journal).data, HistoryService.dirtyFor("needs")); await this.render(); }
  static async _addCustomState() { return this._promptCustomState(false); }
  static async _editCustomState(_event, target) { return this._promptCustomState(true, target.dataset.index); }
  static async _promptCustomState(edit, index) { if (!this.journal || !game.user?.isGM) return; const current = edit ? repository.load(this.journal)?.data?.customStates?.[Number(index)] : null; const formData = await DialogV2.input({ content: `<label>${localize("CST.StateName")} <input name="name" required maxlength="150" value="${escapeHtml(current?.name ?? "")}"></label><label>${localize("CST.Intensity")} <input name="intensity" type="number" min="1" max="5" value="${current?.intensity ?? 1}"></label><label>${localize("CST.Description")} <textarea name="description">${escapeHtml(current?.description ?? "")}</textarea></label><label>${localize("CST.Consequences")} <textarea name="consequences">${escapeHtml(current?.consequences ?? "")}</textarea></label>${presetOptions(current?.presentationKey)}`, ok: { label: edit ? localize("CST.Save") : localize("CST.Add") } }); if (!formData) return; await repository.mutate(this.journal, data => { let state = edit ? data.customStates[Number(index)] : null; const now = new Date().toISOString(); if (!state) { state = { id: randomId(), name: "", intensity: 1, description: "", consequences: "", presentationKey: null, createdAt: now, updatedAt: now, active: true }; data.customStates.push(state); } state.name = String(formValue(formData, "name") ?? state.name).trim().slice(0, 150); state.intensity = clamp(formValue(formData, "intensity"), 1, 5, state.intensity); state.description = String(formValue(formData, "description") ?? "").slice(0, 10000); state.consequences = String(formValue(formData, "consequences") ?? "").slice(0, 10000); state.presentationKey = PRESENTATION_KEYS.includes(formValue(formData, "presentationKey")) ? formValue(formData, "presentationKey") : null; state.updatedAt = now; data.history.push(HistoryService.event({ category: "state", action: edit ? "edit" : "create", label: state.name })); return data; }); await pageService.syncPages(this.journal, repository.load(this.journal).data, HistoryService.dirtyFor("state")); await this.render(); }
  static async _setCustomStateActive(_event, target, active) { if (!this.journal || !game.user?.isGM) return; await repository.mutate(this.journal, data => { const state = data.customStates[Number(target.dataset.index)]; if (state) { state.active = active; state.updatedAt = new Date().toISOString(); data.history.push(HistoryService.event({ category: "state", action: active ? "restore" : "archive", label: state.name })); } return data; }); await pageService.syncPages(this.journal, repository.load(this.journal).data, HistoryService.dirtyFor("state")); await this.render(); }
  static async _archiveCustomState(event, target) { return this._setCustomStateActive(event, target, false); }
  static async _restoreCustomState(event, target) { return this._setCustomStateActive(event, target, true); }
  static async _historyLoadMore() { this.historyPage += 1; await this.render(); }
  static async _setHistoryCategory(_event, target) { this.historyCategory = target.dataset.category || "all"; this.historyPage = 1; await this.render(); }
  static async _runDiagnostics() { if (!this.journal) return; const result = inspectProfile(this.journal); const message = result.issues.length ? result.issues.map(issue => issue.code).join(", ") : localize("CST.DiagnosticsOk"); ui.notifications.info(message); }
  static async _openNotes() { if (!this.journal) return; const page = repository.pageMap(this.journal).get("notes") ?? this.journal.pages?.contents?.find(item => item.name === localize("CST.Pages.Notes")); if (page) return page.sheet?.render(true); return pageService.restoreNotesPage(this.journal); }
  static async _saveTemperature() { if (!this.journal || !game.user?.isGM) return; const values = ["value", "normalMin", "normalMax"].map(key => Number(this.element?.querySelector(`[data-cst-temperature="${key}"]`)?.value)); await repository.mutate(this.journal, data => { ["value", "normalMin", "normalMax"].forEach((key, index) => { if (Number.isFinite(values[index])) data.temperature[key] = clamp(values[index], -100, 200, data.temperature[key]); }); data.history.push(HistoryService.event({ category: "temperature", action: "edit", label: localize("CST.PageTemperature") })); return data; }); await pageService.syncPages(this.journal, repository.load(this.journal).data, HistoryService.dirtyFor("temperature")); await this.render(); }
  static async _saveProfileSettings() { if (!this.journal || !game.user?.isGM) return; const current = repository.load(this.journal)?.data?.profile; const formData = await DialogV2.input({ content: `<label>${localize("CST.ProfileName")} <input name="name" required maxlength="150" value="${escapeHtml(current?.name ?? "")}"></label><label>${localize("CST.ImagePath")} <input name="image" maxlength="2048" value="${escapeHtml(current?.image ?? "")}"></label>`, ok: { label: localize("CST.Save") } }); if (!formData) return; await repository.mutate(this.journal, data => { data.profile.name = String(formValue(formData, "name") ?? data.profile.name).trim().slice(0, 150); data.profile.image = String(formValue(formData, "image") ?? "").slice(0, 2048); data.history.push(HistoryService.event({ category: "profile", action: "edit", label: localize("CST.ProfileName") })); return data; }); await repository.renameJournal(this.journal, `${localize("CST.JournalPrefix")} - ${repository.load(this.journal).data.profile.name}`); await pageService.syncPages(this.journal, repository.load(this.journal).data, HistoryService.dirtyFor("profile")); await this.render(); }
  static async _useActorName() { const actor = game.user?.character; if (!actor || !this.journal || !game.user?.isGM) return; await repository.mutate(this.journal, data => { const oldValue = data.profile.name; data.profile.actorUuid = actor.uuid; data.profile.name = actor.name; data.history.push(HistoryService.event({ category: "profile", action: "actor-name", label: localize("CST.UseActorName"), oldValue, newValue: actor.name })); return data; }); await repository.renameJournal(this.journal, `${localize("CST.JournalPrefix")} - ${actor.name}`); await pageService.syncPages(this.journal, repository.load(this.journal).data, HistoryService.dirtyFor("profile")); await this.render(); }
  static async _useActorImage() { const actor = game.user?.character; if (!actor?.img || !this.journal || !game.user?.isGM) return; await repository.mutate(this.journal, data => { data.profile.actorUuid = actor.uuid; data.profile.image = actor.img; data.history.push(HistoryService.event({ category: "profile", action: "actor-image", label: localize("CST.UseActorImage") })); return data; }); await pageService.syncPages(this.journal, repository.load(this.journal).data, HistoryService.dirtyFor("profile")); await this.render(); }
  static async _refresh() { await this.render(); }
}

export let app = null;
export function openApp() { if (app?.rendered) { app.bringToFront(); return app; } app = new CharacterStateApp(); app.render({ force: true }); return app; }
export async function closeApp() { if (!app) return; await app.flushDrafts(); await repository.flush(); await app.close(); app = null; }
export function onExternalUpdate(journalId) { return app?.handleExternalUpdate(journalId); }
export function onExternalDelete(journalId) { return app?.handleExternalDelete(journalId); }
