import { DATA_KEY, LEGACY_SCOPE, MANAGED_PAGE_ROLES, MODULE_ID, PAGE_KEY, PAGE_ROLES, HISTORY_JOURNAL_LIMIT } from "../core/constants.js";
import { localize } from "../core/localization.js";
import { escapeHtml } from "../utils/object.js";
import { summarize } from "./summary-service.js";

export class JournalPageService {
  moduleRole(page) { return page?.getFlag(MODULE_ID, PAGE_KEY)?.role ?? null; }
  legacyRole(page) { return page?.getFlag(LEGACY_SCOPE, PAGE_KEY)?.role ?? null; }
  pageMap(journal) {
    const map = new Map();
    for (const page of journal?.pages?.contents ?? []) { const role = this.moduleRole(page); if (role && !map.has(role)) map.set(role, page); }
    return map;
  }
  render(role, data) {
    const title = localize(PAGE_ROLES[role]); const name = escapeHtml(data.profile.name); let body = `<p>${name}</p>`;
    if (role === "summary") { const summary = summarize(data); body += `<p>${escapeHtml(localize("CST.PageProblems"))}: ${summary.count}</p><ul>${summary.problems.map(p => `<li>${escapeHtml(p.label || p.kind)}: ${escapeHtml(p.value)}</li>`).join("")}</ul>`; }
    if (role === "physical") body += `<h2>${escapeHtml(localize("CST.PageBody"))}</h2><ul>${data.body.partOrder.map(id => { const p = data.body.parts[id]; return `<li><strong>${escapeHtml(p.name)}</strong>: ${p.value}/100; ${escapeHtml(localize("CST.PagePain"))}: ${p.localPain}/100</li>`; }).join("")}</ul>`;
    if (role === "mental") body += `<h2>${escapeHtml(localize("CST.PageMental"))}</h2><ul>${Object.values(data.mental.axes).filter(m => m.enabled).map(m => `<li>${escapeHtml(m.label)}: ${m.value}${escapeHtml(m.unit)}</li>`).join("")}</ul>`;
    if (role === "needs") body += `<h2>${escapeHtml(localize("CST.PageNeeds"))}</h2><ul>${Object.values(data.needs.standard).filter(m => m.enabled).map(m => `<li>${escapeHtml(m.label)}: ${m.value}${escapeHtml(m.unit)}</li>`).join("")}</ul><p>${escapeHtml(localize("CST.PageTemperature"))}: ${data.temperature.value}${escapeHtml(data.temperature.unit)}</p>`;
    if (role === "history") body += `<ol>${[...data.history].sort((a,b) => String(b.timestamp).localeCompare(String(a.timestamp))).slice(0, HISTORY_JOURNAL_LIMIT).map(e => `<li>${escapeHtml(e.timestamp)} — ${escapeHtml(e.label)}${e.reason ? ` (${escapeHtml(e.reason)})` : ""}</li>`).join("")}</ol>`;
    return `<article class="cst-journal"><h1>${escapeHtml(title)}</h1>${body}<hr><small>Character State Tracker ${escapeHtml(String(data.appVersion))} · schema ${data.schemaVersion} · revision ${data.revision}</small></article>`;
  }
  async ensurePages(journal, data) { return this.syncPages(journal, data, MANAGED_PAGE_ROLES); }
  async syncPages(journal, data, roles = MANAGED_PAGE_ROLES) {
    if (!game.user?.isGM) return { dirtyPages: [] };
    const map = this.pageMap(journal); const dirtyPages = [];
    for (const role of roles) {
      const title = localize(PAGE_ROLES[role]); const html = this.render(role, data); const page = map.get(role);
      if (!page) {
        await journal.createEmbeddedDocuments("JournalEntryPage", [{ name: title, type: "text", text: { format: 1, content: html }, flags: { [MODULE_ID]: { [PAGE_KEY]: { role, managed: true, generatedBy: MODULE_ID } } } }], { cstInternal: true });
        dirtyPages.push(role); continue;
      }
      if (page.getFlag(MODULE_ID, PAGE_KEY)?.managed === false) continue;
      if (page.text?.content !== html) { await page.update({ name: title, "text.content": html }, { cstInternal: true }); dirtyPages.push(role); }
    }
    return { dirtyPages };
  }
  async repairPages(journal, data) { return this.syncPages(journal, data, MANAGED_PAGE_ROLES); }
  async restoreNotesPage(journal) {
    if (!game.user?.isGM) throw new Error("GM permission required");
    const notes = journal?.pages?.contents?.find(page => this.moduleRole(page) === "notes" || this.legacyRole(page) === "notes");
    if (notes) return notes;
    return journal.createEmbeddedDocuments("JournalEntryPage", [{ name: localize(PAGE_ROLES.notes), type: "text", text: { format: 1, content: "" }, flags: { [MODULE_ID]: { [PAGE_KEY]: { role: "notes", managed: false, generatedBy: MODULE_ID } } } }], { cstInternal: true });
  }
}
export const pageService = new JournalPageService();
