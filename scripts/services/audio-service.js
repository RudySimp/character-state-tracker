import { MODULE_ID } from "../core/constants.js";
import { AUDIO_CUES } from "../core/audio-registry.js";
export const AudioService = {
  last: new Map(),
  current: null,
  canPlay(key) { return Boolean(AUDIO_CUES[key]) && game.settings.get(MODULE_ID, "enableSfx") && !game.settings.get(MODULE_ID, "muteSfx"); },
  async playCue(key, { cooldown = 2500 } = {}) { if (!this.canPlay(key)) return false; const now = Date.now(); if (now - (this.last.get(key) ?? 0) < cooldown) return false; this.last.set(key, now); try { const broadcast = Boolean(game.user?.isGM && game.settings.get(MODULE_ID, "broadcastSfx")); this.current = await AudioHelper.play({ src: AUDIO_CUES[key], volume: Number(game.settings.get(MODULE_ID, "sfxVolume") ?? 0.35), autoplay: true, loop: false }, broadcast); return this.current; } catch (_) { return false; } },
  preview(key) { return this.playCue(key, { cooldown: 0 }); },
  stopCurrent() { try { this.current?.stop?.(); } catch (_) {} this.current = null; }
};
