export function isObject(value) { return value !== null && typeof value === "object" && !Array.isArray(value); }
export function clone(value) { return value == null ? value : structuredClone(value); }
export function clamp(value, min, max, fallback = min) { const n=Number(value); return Number.isFinite(n) ? Math.min(max,Math.max(min,n)) : fallback; }
export function stableId(seed) { let h=2166136261; for(const c of String(seed)) { h^=c.charCodeAt(0); h=Math.imul(h,16777619); } return `repair-${(h>>>0).toString(36)}`; }
export function randomId() { return globalThis.foundry?.utils?.randomID?.(16) ?? globalThis.crypto?.randomUUID?.() ?? `cst-${Date.now().toString(36)}-${Math.random().toString(36).slice(2)}`; }
export function decimalPlaces(step) { const s=String(step).toLowerCase(); if(s.includes("e")){const [c,e]=s.split("e");return Math.max(0,(c.split(".")[1]?.length??0)-Number(e));} return s.split(".")[1]?.length??0; }
export function snapToStep(value, step, min=0) { const s=Number(step)>0?Number(step):1; const v=Number(value); if(!Number.isFinite(v)) return min; return Number((Math.round((v-min)/s)*s+min).toFixed(Math.min(12,decimalPlaces(s)+2))); }
export function escapeHtml(value) { return String(value??"").replaceAll("&","&amp;").replaceAll("<","&lt;").replaceAll(">","&gt;").replaceAll('"',"&quot;").replaceAll("'","&#039;"); }
export function safeImagePath(value) { const s=String(value??"").replace(/[\u0000-\u001f\u007f]/g,"").trim().slice(0,2048); if(!s||s.startsWith("//")) return ""; const scheme=s.match(/^([a-z][a-z0-9+.-]*):/i)?.[1]?.toLowerCase(); if(!scheme) return s; if(["http","https"].includes(scheme)) return s; return scheme==="data"&&/^data:image\/(?:png|jpe?g|gif|webp|avif);base64,/i.test(s)?s:""; }
