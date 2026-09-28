import { HISTORY_PAGE_SIZE } from "../core/constants.js";
import { randomId } from "../utils/object.js";
export const HistoryService = {
  event({ category = "system", target = "", action = "change", label = "Change", oldValue = null, newValue = null, reason = "" } = {}) {
    return { id: randomId(), timestamp: new Date().toISOString(), category, target, action, label, oldValue, newValue, reason: String(reason).slice(0, 500), userId: globalThis.game?.user?.id ?? null, userName: globalThis.game?.user?.name ?? "Unknown" };
  },
  sorted(history = []) { return [...history].sort((a, b) => String(b.timestamp || "").localeCompare(String(a.timestamp || ""))); },
  matches(event, { category = "all", query = "" } = {}) { if (category !== "all" && event.category !== category) return false; return !query || [event.label, event.reason, event.userName, event.target, event.oldValue, event.newValue].join(" ").toLocaleLowerCase().includes(String(query).toLocaleLowerCase()); },
  filter(history, options = {}) { return this.sorted(history).filter(event => this.matches(event, options)); },
  page(history, page = 1, options = {}) { const filtered = this.filter(history, options); return { items: filtered.slice(0, Math.max(1, page) * HISTORY_PAGE_SIZE), total: filtered.length, hasMore: filtered.length > Math.max(1, page) * HISTORY_PAGE_SIZE }; },
  dirtyFor(categories) { const result = new Set(); for (const category of Array.isArray(categories) ? categories : [categories]) { if (["body", "injury", "pain"].includes(category)) ["summary", "physical", "history"].forEach(x => result.add(x)); else if (["mental", "emotional"].includes(category)) ["summary", "mental", "history"].forEach(x => result.add(x)); else if (["needs", "temperature", "state"].includes(category)) ["summary", "needs", "history"].forEach(x => result.add(x)); else if (category === "profile") ["summary", "physical", "mental", "needs", "history"].forEach(x => result.add(x)); else result.add("history"); } return [...result]; }
};
