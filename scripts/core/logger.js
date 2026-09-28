import { MODULE_ID } from "./constants.js";
const prefix = "Character State Tracker |";
export const Logger = {
  debug(...args) { if (globalThis.game?.settings?.get?.(MODULE_ID, "debug")) console.debug(prefix, ...args); },
  warn(...args) { console.warn(prefix, ...args); },
  error(...args) { console.error(prefix, ...args); }
};
