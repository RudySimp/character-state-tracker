import {BODY_ORDER,MODULE_VERSION,SCHEMA_VERSION} from "../core/constants.js";
import {clone,isObject} from "../utils/object.js";
const migrate1to2=data=>{const d=clone(data);d.body??={};d.body.parts??={};if(!d.body.parts.back)d.body.parts.back={id:"back",name:"Спина",enabled:true,value:100,localPain:0,notes:"",injuries:[]};d.body.partOrder=[...BODY_ORDER];d.ui??={};if(!["front","back"].includes(d.ui.bodyView))d.ui.bodyView="front";d.schemaVersion=2;d.appVersion=MODULE_VERSION;return d;};
export const MIGRATIONS=Object.freeze({1:migrate1to2});
export function sourceSchema(raw){return Number.isInteger(Number(raw?.schemaVersion))?Number(raw.schemaVersion):1;}
export function migrateData(raw){if(!isObject(raw))throw new TypeError("Profile must be an object");const source=sourceSchema(raw);if(source>SCHEMA_VERSION)return {data:clone(raw),sourceSchema:source,future:true,migrated:false};let data=clone(raw);let version=source;while(version<SCHEMA_VERSION){const migration=MIGRATIONS[version];if(!migration)throw new Error(`Missing migration from schema ${version}`);data=migration(data);version++;}return {data,sourceSchema:source,future:false,migrated:source!==SCHEMA_VERSION};}
