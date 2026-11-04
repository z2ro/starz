import type { Catalog,State } from '../types/game';
import { FirstSessionGuide } from './FirstSessionGuide';
import { ReturnSummary } from './ReturnSummary';
import { useUniverse } from './useUniverse';
export function SessionExperience({state,catalog,planetId}:{state:State;catalog:Catalog;planetId?:string}){const q=useUniverse(planetId);return q.data?<div className="ux-session"><ReturnSummary key={`return-${q.data.empire_id}`} state={state} catalog={catalog} empireId={q.data.empire_id}/><FirstSessionGuide key={q.data.empire_id} state={state} empireId={q.data.empire_id}/></div>:null;}
