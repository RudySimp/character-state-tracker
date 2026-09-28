import { BODY_ORDER, MODULE_VERSION, SCHEMA_VERSION } from "../core/constants.js";
import { randomId } from "../utils/object.js";

const metric = (id, label, value, direction, enabled = true) => ({
  id, label, enabled, value, min: 0, max: 100, step: 1, unit: "", direction,
  minLabel: "", maxLabel: ""
});
const need = (id, label, enabled) => ({
  ...metric(id, label, 0, "higher-is-worse", enabled),
  minLabel: "Нет потребности", maxLabel: "Критическая потребность"
});
const bodyNames = {
  head: "Голова", neck: "Шея", torso: "Грудная клетка", abdomen: "Живот", back: "Спина",
  leftArm: "Левая рука", rightArm: "Правая рука", leftHand: "Левая кисть", rightHand: "Правая кисть",
  leftLeg: "Левая нога", rightLeg: "Правая нога", leftFoot: "Левая стопа", rightFoot: "Правая стопа"
};

export const Factory = {
  metric,
  defaults(profile = {}) {
    const now = new Date().toISOString();
    const parts = Object.fromEntries(BODY_ORDER.map(id => [id, {
      id, name: bodyNames[id], enabled: true, value: 100, localPain: 0, notes: "", injuries: []
    }]));
    return {
      schemaVersion: SCHEMA_VERSION, appVersion: MODULE_VERSION, revision: 1,
      profile: {
        id: randomId(), name: String(profile.name || "Новый персонаж"), actorUuid: profile.actorUuid || null,
        image: String(profile.image || ""), createdAt: now, updatedAt: now, archived: false, sort: 0
      },
      config: {
        physicalEnabled: true, painEnabled: true, mentalEnabled: true, emotionalEnabled: true,
        needsEnabled: true, temperatureEnabled: true, customStatesEnabled: true
      },
      body: {
        overall: { enabled: true, value: 100 }, pain: { enabled: true, value: 0 },
        parts, partOrder: [...BODY_ORDER]
      },
      mental: {
        axes: {
          stability: metric("stability", "Ментальная устойчивость", 100, "higher-is-better"),
          stress: metric("stress", "Стресс", 0, "higher-is-worse"),
          fear: metric("fear", "Страх", 0, "higher-is-worse"),
          selfControl: metric("selfControl", "Самоконтроль", 100, "higher-is-better"),
          concentration: metric("concentration", "Концентрация", 100, "higher-is-better"),
          exhaustion: metric("exhaustion", "Ментальное истощение", 0, "higher-is-worse"),
          confusion: metric("confusion", "Спутанность", 0, "higher-is-worse")
        }, customAxes: [], conditions: []
      },
      emotional: {
        axes: {
          mood: metric("mood", "Настроение", 70, "higher-is-better"),
          satisfaction: metric("satisfaction", "Удовлетворённость жизнью", 70, "higher-is-better"),
          hope: metric("hope", "Надежда", 70, "higher-is-better"),
          safety: metric("safety", "Ощущение безопасности", 70, "higher-is-better"),
          loneliness: metric("loneliness", "Одиночество", 20, "higher-is-worse"),
          motivation: metric("motivation", "Мотивация", 70, "higher-is-better")
        }, customAxes: [], conditions: []
      },
      needs: {
        standard: {
          hunger: need("hunger", "Голод", true), thirst: need("thirst", "Жажда", true),
          sleep: need("sleep", "Потребность во сне", true), rest: need("rest", "Потребность в отдыхе", true),
          warmth: need("warmth", "Потребность в тепле", true), hygiene: need("hygiene", "Гигиена", false),
          safety: need("safety", "Потребность в безопасности", true), social: need("social", "Потребность в общении", false),
          comfort: need("comfort", "Комфорт", false)
        }, custom: []
      },
      temperature: { enabled: true, value: 36.6, normalMin: 36, normalMax: 37.2, unit: "°C" },
      customStates: [], history: [], ui: { selectedSection: "body", selectedBodyPart: "torso", bodyView: "front", lastSelectedAt: null }
    };
  }
};
