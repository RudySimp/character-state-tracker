import { BODY_ORDER, INJURY_PHASES, MODULE_VERSION, SCHEMA_VERSION } from "../core/constants.js";
import { Factory } from "./factory.js";
import { clamp, clone, isObject, safeImagePath, snapToStep, stableId } from "../utils/object.js";
import { PRESENTATIONS } from "../core/presentation-registry.js";

function mergeDefaults(base, input) {
  if (Array.isArray(base)) return Array.isArray(input) ? clone(input) : clone(base);
  if (!isObject(base)) return input === undefined ? clone(base) : input;
  if (input !== undefined && Array.isArray(input)) throw new TypeError("Incompatible structured container");
  const out = isObject(input) ? clone(input) : {};
  for (const [key, value] of Object.entries(base)) out[key] = key in out ? mergeDefaults(value, out[key]) : clone(value);
  return out;
}

function normalizeMetric(raw, defaults) {
  const metric = mergeDefaults(defaults, raw);
  metric.enabled = metric.enabled !== false;
  metric.min = Number.isFinite(Number(metric.min)) ? Number(metric.min) : Number(defaults.min ?? 0);
  metric.max = Number.isFinite(Number(metric.max)) && Number(metric.max) > metric.min ? Number(metric.max) : metric.min + 100;
  metric.step = Number(metric.step) > 0 ? Number(metric.step) : 1;
  metric.value = clamp(snapToStep(metric.value, metric.step, metric.min), metric.min, metric.max, metric.min);
  metric.direction = metric.direction === "higher-is-better" ? "higher-is-better" : "higher-is-worse";
  metric.id = String(metric.id || defaults.id || "metric");
  metric.label = String(metric.label || defaults.label || metric.id).slice(0, 150);
  metric.unit = String(metric.unit || "").slice(0, 16);
  return metric;
}

function normalizeCollection(items, namespace, map = x => x) {
  const source = Array.isArray(items) ? items : [];
  const seen = new Set();
  return source.map((item, index) => {
    const value = map(isObject(item) ? clone(item) : {});
    let id = String(value.id || stableId(`${namespace}:${index}:${JSON.stringify(value)}`));
    let salt = 0;
    while (seen.has(id)) id = stableId(`${namespace}:${index}:${id}:${salt++}`);
    seen.add(id); value.id = id; return value;
  });
}

function normalizeInjury(raw) {
  const now = new Date().toISOString();
  const injury = mergeDefaults({ id: null, name: "Травма", severity: 1, phase: "fresh", description: "", consequences: "", createdAt: now, updatedAt: now, active: true }, raw);
  injury.name = String(injury.name || "Травма").slice(0, 150); injury.severity = Math.round(clamp(injury.severity, 1, 5, 1));
  injury.phase = INJURY_PHASES.includes(injury.phase) ? injury.phase : "fresh"; injury.description = String(injury.description || "").slice(0, 10000);
  injury.consequences = String(injury.consequences || "").slice(0, 10000); injury.active = injury.active !== false;
  injury.presentationKey = PRESENTATIONS[injury.presentationKey] ? injury.presentationKey : null;
  return injury;
}

export function normalizeProfile(input, { preserveFutureSchema = false } = {}) {
  if (!isObject(input)) throw new TypeError("Profile root must be an object");
  for (const key of ["profile", "config", "body", "mental", "emotional", "needs", "temperature", "ui"]) {
    if (input[key] !== undefined && !isObject(input[key])) throw new TypeError(`${key} must be an object`);
  }
  if (input.body?.parts !== undefined && !isObject(input.body.parts)) throw new TypeError("body.parts must be an object");
  const base = Factory.defaults({ name: input.profile?.name });
  const data = mergeDefaults(base, input);
  data.schemaVersion = preserveFutureSchema ? Number(input.schemaVersion) : SCHEMA_VERSION;
  data.appVersion = String(data.appVersion || MODULE_VERSION);
  data.revision = Math.max(1, Math.trunc(Number(data.revision) || 1));
  data.profile.name = String(data.profile.name || "Персонаж").slice(0, 150);
  data.profile.image = safeImagePath(data.profile.image); data.profile.actorUuid = String(data.profile.actorUuid || "").slice(0, 512) || null;
  data.body.partOrder = [...BODY_ORDER];
  for (const id of BODY_ORDER) {
    const part = data.body.parts[id] = mergeDefaults(base.body.parts[id], data.body.parts[id]);
    part.id = id; part.value = clamp(part.value, 0, 100, 100); part.localPain = clamp(part.localPain, 0, 100, 0); part.notes = String(part.notes || "").slice(0, 10000);
    part.injuries = normalizeCollection(part.injuries, `injury:${data.profile.id}`, normalizeInjury);
  }
  for (const area of ["mental", "emotional"]) {
    for (const [id, metric] of Object.entries(data[area].axes)) data[area].axes[id] = normalizeMetric(metric, base[area].axes[id] || Factory.metric(id, id, 0, "higher-is-worse"));
    data[area].customAxes = normalizeCollection(data[area].customAxes, `${area}:axis`, x => normalizeMetric(x, Factory.metric(x.id || "custom", x.label || "Параметр", 0, "higher-is-worse")));
    data[area].conditions = normalizeCollection(data[area].conditions, `${area}:condition`, x => { x.presentationKey = PRESENTATIONS[x.presentationKey] ? x.presentationKey : null; x.intensity = Math.round(clamp(x.intensity, 1, 5, 1)); x.active = x.active !== false; return x; });
  }
  for (const [id, metric] of Object.entries(data.needs.standard)) data.needs.standard[id] = normalizeMetric(metric, base.needs.standard[id] || Factory.metric(id, id, 0, "higher-is-worse"));
  data.needs.custom = normalizeCollection(data.needs.custom, "needs:custom", x => normalizeMetric(x, Factory.metric(x.id || "custom", x.label || "Потребность", 0, "higher-is-worse")));
  data.customStates = normalizeCollection(data.customStates, "state", x => { x.presentationKey = PRESENTATIONS[x.presentationKey] ? x.presentationKey : null; x.intensity = Math.round(clamp(x.intensity, 1, 5, 1)); x.active = x.active !== false; return x; }); data.history = normalizeCollection(data.history, "history");
  data.temperature.value = clamp(data.temperature.value, -100, 200, 36.6); data.temperature.normalMin = clamp(data.temperature.normalMin, -100, 200, 36); data.temperature.normalMax = clamp(data.temperature.normalMax, -100, 200, 37.2);
  if (data.temperature.normalMax < data.temperature.normalMin) [data.temperature.normalMin, data.temperature.normalMax] = [data.temperature.normalMax, data.temperature.normalMin];
  if (!["front", "back"].includes(data.ui.bodyView)) data.ui.bodyView = "front"; if (!data.body.parts[data.ui.selectedBodyPart]) data.ui.selectedBodyPart = "torso";
  return data;
}
