import { BODY_THRESHOLDS, PAIN_THRESHOLDS } from "../core/constants.js";
const threshold = (value, table) => table.find(item => value >= item.min) ?? table.at(-1);
const metricSeverity = metric => { const percent = ((Number(metric.value) - Number(metric.min)) / (Number(metric.max) - Number(metric.min))) * 100; return metric.direction === "higher-is-better" ? 100 - percent : percent; };
export function summarize(data) {
  const problems = []; const add = (kind, label, value, severity) => problems.push({ kind, label, value, severity });
  if (data.config.physicalEnabled) {
    if (data.body.overall.enabled && data.body.overall.value < 86) add("overall", "Общее состояние", `${data.body.overall.value}/100`, 100 - data.body.overall.value);
    if (data.config.painEnabled && data.body.pain.enabled && data.body.pain.value >= 61) add("pain", "Боль", `${data.body.pain.value}/100`, data.body.pain.value);
    for (const part of Object.values(data.body.parts)) if (part.enabled && part.value < 71) add("part", part.name, `${part.value}/100`, 100 - part.value);
    for (const part of Object.values(data.body.parts)) for (const injury of part.injuries.filter(item => item.active)) add("injury", injury.name, `${injury.severity}/5`, injury.severity * 20);
  }
  for (const area of ["mental", "emotional"]) if (data.config[`${area}Enabled`]) {
    for (const metric of [...Object.values(data[area].axes), ...data[area].customAxes]) if (metric.enabled && metricSeverity(metric) >= 61) add(area, metric.label, `${metric.value}${metric.unit}`, metricSeverity(metric));
    for (const condition of data[area].conditions.filter(item => item.active && item.intensity >= 3)) add(`${area}-condition`, condition.name, `${condition.intensity}/5`, condition.intensity * 20);
  }
  if (data.config.needsEnabled) for (const metric of [...Object.values(data.needs.standard), ...data.needs.custom]) if (metric.enabled && metricSeverity(metric) >= 61) add("need", metric.label, `${metric.value}${metric.unit}`, metricSeverity(metric));
  if (data.config.temperatureEnabled && data.temperature.enabled && (data.temperature.value < data.temperature.normalMin || data.temperature.value > data.temperature.normalMax)) add("temperature", "Температура", `${data.temperature.value}${data.temperature.unit}`, 61);
  if (data.config.customStatesEnabled) for (const state of data.customStates.filter(item => item.active)) add("state", state.name, `${state.intensity}/5`, state.intensity * 20);
  problems.sort((a, b) => b.severity - a.severity); return { problems, count: problems.length, overall: threshold(data.body.overall.value, BODY_THRESHOLDS), pain: threshold(data.body.pain.value, PAIN_THRESHOLDS) };
}
export function buildSummaryText(data) { const result = summarize(data); if (!result.problems.length) return "Активных отклонений не обнаружено."; return result.problems.slice(0, 12).map(item => `${item.label}: ${item.value}`).join("\n"); }
