import { ASSETS } from "./asset-registry.js";
import { AUDIO_CUES } from "./audio-registry.js";

export const PRESENTATION_KEYS = Object.freeze([
  "healthy", "injury", "exhaustion", "hunger", "thirst", "stress", "panic", "confusion", "calm", "temperature",
  "bleeding", "poisoning", "nausea", "suffocation", "adrenaline", "shock", "fracture", "recovery", "fainting", "regaining-consciousness",
  "vertigo", "tremor", "numbness", "paralysis", "muscle-cramp", "convulsion", "intoxication", "severe-pain", "critical-condition", "deep-rest"
]);
const art = {
  healthy: ASSETS.injury.healthy, injury: ASSETS.injury.generic, exhaustion: ASSETS.physiology.rest,
  hunger: ASSETS.physiology.hunger, thirst: ASSETS.physiology.thirst, stress: ASSETS.mental.stress,
  panic: ASSETS.mental.fear, confusion: ASSETS.mental.confusion, calm: ASSETS.emotional.calm,
  temperature: ASSETS.sections.temperature, bleeding: ASSETS.injury.bloodLoss, poisoning: ASSETS.injury.generic,
  nausea: ASSETS.injury.generic, suffocation: ASSETS.injury.critical, adrenaline: ASSETS.emotional.motivation,
  shock: ASSETS.injury.critical, fracture: ASSETS.injury.severe, recovery: ASSETS.injury.healthy,
  fainting: ASSETS.mental.exhaustion, "regaining-consciousness": ASSETS.emotional.hope,
  vertigo: ASSETS.mental.confusion, tremor: ASSETS.mental.stress, numbness: ASSETS.body.leftHand,
  paralysis: ASSETS.injury.incapacitated, "muscle-cramp": ASSETS.body.leftLeg, convulsion: ASSETS.injury.critical,
  intoxication: ASSETS.mental.confusion, "severe-pain": ASSETS.sections.pain,
  "critical-condition": ASSETS.injury.critical, "deep-rest": ASSETS.physiology.rest
};
const automaticCue = {
  exhaustion: "exhaustionDeep", hunger: "hungerDeep", thirst: "thirstDeep", stress: "stressDeep",
  panic: "panicDeep", confusion: "confusionDeep", calm: "calmDeep", injury: "injuryDeep",
  bleeding: "bleeding", poisoning: "poisoning", nausea: "nausea", suffocation: "suffocation",
  adrenaline: "adrenaline", shock: "shock", fracture: "fracture", recovery: "recovery",
  fainting: "fainting", "regaining-consciousness": "regainingConsciousness", vertigo: "vertigo",
  tremor: "tremor", numbness: "numbness", paralysis: "paralysis", "muscle-cramp": "muscleCramp",
  convulsion: "convulsion", intoxication: "intoxication", "severe-pain": "severePain",
  "critical-condition": "criticalCondition", "deep-rest": "deepRest"
};
export const PRESENTATIONS = Object.freeze(Object.fromEntries(PRESENTATION_KEYS.map(key => [key, { art: art[key] ?? ASSETS.injury.generic, cue: automaticCue[key] ?? null }])));
export function presentation(key) { return PRESENTATIONS[key] ?? null; }
export function presentationCue(key) { const cue = PRESENTATIONS[key]?.cue; return cue && AUDIO_CUES[cue] ? cue : null; }
