export type MissionDraft = { ids:string[]; mission:string; target:string; x:number; y:number; index:number; resource:string; amount:number; doctrine?:string; weapon_profile?:string; target_stellar_id?:string; target_subsystem?:string; stellar_project_id?:string; module_ids?:string[] };
export function readMissionDraft(planetId:string):Partial<MissionDraft>{
 try{const value:unknown=JSON.parse(sessionStorage.getItem(`starz.mission.${planetId}`)??'{}');if(!value||typeof value!=='object')return {};const v=value as Record<string,unknown>,draft:Partial<MissionDraft>={};
 for(const key of ['mission','target','resource','doctrine','weapon_profile','target_stellar_id','target_subsystem','stellar_project_id'] as const)if(typeof v[key]==='string')draft[key]=v[key];
 for(const key of ['x','y','index','amount'] as const)if(typeof v[key]==='number'&&Number.isFinite(v[key]))draft[key]=v[key];
 if(Array.isArray(v.module_ids)&&v.module_ids.every(id=>typeof id==='string'))draft.module_ids=v.module_ids;
 if(Array.isArray(v.ids)&&v.ids.every(id=>typeof id==='string'))draft.ids=v.ids;return draft;
 }catch{return {};}
}
export function saveMissionDraft(planetId:string,draft:MissionDraft){try{sessionStorage.setItem(`starz.mission.${planetId}`,JSON.stringify(draft));}catch{/* Navigation still works when browser storage is unavailable. */}}
