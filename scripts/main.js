import {MODULE_ID, MODULE_VERSION, SCHEMA_VERSION} from "./core/constants.js";
import {openApp, closeApp, onExternalUpdate, onExternalDelete} from "./applications/character-state-app.js";
import {repository} from "./services/repository.js";
import {Logger} from "./core/logger.js";
import {localize} from "./core/localization.js";

Hooks.once("init", () => {
  game.settings.register(MODULE_ID, "showLaunchButton", {name: "CST.Settings.ShowButton",hint: "CST.Settings.ShowButtonHint",scope: "client",config: true,type: Boolean,default: true});
  game.settings.register(MODULE_ID, "debug", {name: "CST.Settings.Debug",hint: "CST.Settings.DebugHint",scope: "client",config: true,type: Boolean,default: false});
  game.settings.register(MODULE_ID, "enableSfx", {name: "CST.Settings.EnableSfx",hint: "CST.Settings.EnableSfxHint",scope: "client",config: true,type: Boolean,default: false});
  game.settings.register(MODULE_ID, "muteSfx", {name: "CST.Settings.MuteSfx",scope: "client",config: true,type: Boolean,default: false});
  game.settings.register(MODULE_ID, "sfxVolume", {name: "CST.Settings.SfxVolume",scope: "client",config: true,type: Number,default: 0.35,range: {min: 0, max: 1, step: 0.05}});
  game.settings.register(MODULE_ID, "broadcastSfx", {name: "CST.Settings.BroadcastSfx",scope: "world",config: true,type: Boolean,default: false});
  const pack=game.modules.get(MODULE_ID); if(pack) pack.api=Object.freeze({open:openApp,close:closeApp,version:MODULE_VERSION,schemaVersion:SCHEMA_VERSION});
  game.keybindings.register(MODULE_ID,"open",{name:"CST.Keybinding.Open",editable:["KeyC","Control"],onDown:()=>{openApp();return true;},restricted:false});
});
Hooks.once("ready", () => { if(game.user?.isGM) for(const journal of game.journal?.contents??[]) if(repository.getLegacyFlag(journal)&&!repository.getFlag(journal)) Logger.warn("Legacy profile detected",journal.id); });
Hooks.on("renderJournalDirectory", (_app,html) => { if(!game.settings.get(MODULE_ID,"showLaunchButton"))return; const root=html instanceof HTMLElement?html:html[0]; if(!root||root.querySelector("[data-cst-launch]"))return; const button=document.createElement("button");button.type="button";button.dataset.cstLaunch="true";button.setAttribute("aria-label",localize("CST.Launch"));button.innerHTML=`<i class="fa-solid fa-person"></i> ${localize("CST.Launch")}`;button.addEventListener("click",()=>openApp());root.querySelector(".directory-header")?.append(button); });
Hooks.on("updateJournalEntry", (journal, _change, options) => { if (options?.cstInternal || repository.isInternal(journal)) return; if (repository.getFlag(journal)) onExternalUpdate(journal.id); });
Hooks.on("deleteJournalEntry", journal => onExternalDelete(journal.id));
Hooks.on("createJournalEntryPage", (page, _options) => { if (_options?.cstInternal) return; const parent = page.parent; if (parent?.getFlag?.(MODULE_ID, DATA_KEY)) onExternalUpdate(parent.id); });
Hooks.on("updateJournalEntryPage", (page, _change, _options) => { if (_options?.cstInternal) return; const parent = page.parent; if (parent?.getFlag?.(MODULE_ID, DATA_KEY)) onExternalUpdate(parent.id); });
Hooks.on("deleteJournalEntryPage", (page, _options) => { if (_options?.cstInternal) return; const parent = page.parent; if (parent?.getFlag?.(MODULE_ID, DATA_KEY)) onExternalUpdate(parent.id); });
