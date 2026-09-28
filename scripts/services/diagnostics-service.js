import {DATA_KEY,LEGACY_SCOPE,MANAGED_PAGE_ROLES,MODULE_ID,PAGE_KEY,SCHEMA_VERSION} from "../core/constants.js";
import {validateProfile} from "../data/validator.js";
export function inspectProfile(journal){
  const issues=[]; const current=journal.getFlag(MODULE_ID,DATA_KEY); const legacy=journal.getFlag(LEGACY_SCOPE,DATA_KEY);
  if(legacy&&!current)issues.push({severity:"warning",code:"legacy-profile"}); if(current&&legacy)issues.push({severity:"info",code:"legacy-copy-retained"}); if(!current&&!legacy)issues.push({severity:"error",code:"missing-profile"});
  if(current){ try{validateProfile(current,{allowFuture:true});}catch(error){issues.push({severity:"error",code:"invalid-profile",message:error.message});} if(Number(current.schemaVersion)>SCHEMA_VERSION)issues.push({severity:"warning",code:"future-schema"}); if((current.history?.length??0)>=2000)issues.push({severity:"warning",code:"large-history",count:current.history.length});
    for(const part of Object.values(current.body?.parts??{})){const ids=new Set();for(const injury of part.injuries??[]){if(ids.has(injury.id))issues.push({severity:"error",code:"duplicate-injury",part:part.id,id:injury.id});ids.add(injury.id);}}
  }
  const roles=new Map(); for(const page of journal.pages?.contents??[]){const marker=page.getFlag(MODULE_ID,PAGE_KEY); const role=marker?.role; if(role){roles.set(role,(roles.get(role)??0)+1);if(marker.generatedBy!==MODULE_ID)issues.push({severity:"warning",code:"foreign-generated-page",role});}}
  for(const [role,count] of roles)if(count>1)issues.push({severity:"warning",code:"duplicate-page",role,count}); for(const role of MANAGED_PAGE_ROLES)if(!roles.has(role)&&current)issues.push({severity:"warning",code:"missing-managed-page",role});
  return {journalId:journal.id,issues,legacy:!!legacy,module:!!current};
}
