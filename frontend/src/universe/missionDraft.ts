export type MissionDraft = { ids:string[]; mission:string; target:string; x:number; y:number; index:number; resource:string; amount:number };
export function readMissionDraft(planetId:string):Partial<MissionDraft>{
 try{const value:unknown=JSON.parse(sessionStorage.getItem(`starz.mission.${planetId}`)??'{}');if(!value||typeof value!=='object')return {};const v=value as Record<string,unknown>,draft:Partial<MissionDraft>={};
 for(const key of ['mission','target','resource'] as const)if(typeof v[key]==='string')draft[key]=v[key];
 for(const key of ['x','y','index','amount'] as const)if(typeof v[key]==='number'&&Number.isFinite(v[key]))draft[key]=v[key];
 if(Array.isArray(v.ids)&&v.ids.every(id=>typeof id==='string'))draft.ids=v.ids;return draft;
 }catch{return {};}
}
export function saveMissionDraft(planetId:string,draft:MissionDraft){try{sessionStorage.setItem(`starz.mission.${planetId}`,JSON.stringify(draft));}catch{/* Navigation still works when browser storage is unavailable. */}}
