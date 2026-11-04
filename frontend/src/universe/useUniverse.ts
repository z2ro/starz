import { useQuery } from '@tanstack/react-query';
import { apiRequest } from '../api/client';
import type { Universe } from './types';
export function useUniverse(planetId?:string){return useQuery({queryKey:['universe',planetId],queryFn:()=>apiRequest<Universe>(`/api/universe${planetId?'?planet_id='+encodeURIComponent(planetId):''}`),refetchInterval:10000});}
