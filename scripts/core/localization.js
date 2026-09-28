/** Foundry-backed localization helpers with a safe pre-init fallback. */
export function localize(key) {
  return globalThis.game?.i18n?.localize?.(key) ?? key;
}

export function format(key, data = {}) {
  return globalThis.game?.i18n?.format?.(key, data) ?? localize(key);
}
