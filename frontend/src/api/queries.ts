import { useQuery } from '@tanstack/react-query';
import { apiRequest } from './client';
import type { Catalog, Galaxy, State } from '../types/game';

export const queryKeys = {
  catalog: ['catalog'] as const,
  state: (planetId?: string | null) => ['state', planetId ?? 'default'] as const,
  galaxy: (centerX?: number, centerY?: number, radius = 2) => ['galaxy', centerX ?? 'home', centerY ?? 'home', radius] as const,
};

export function useCatalogQuery() {
  return useQuery({ queryKey: queryKeys.catalog, queryFn: () => apiRequest<Catalog>('/api/catalog'), staleTime: Infinity });
}

export function useStateQuery(planetId?: string | null) {
  const query = planetId ? `/api/state?planet_id=${encodeURIComponent(planetId)}` : '/api/state';
  return useQuery({ queryKey: queryKeys.state(planetId), queryFn: () => apiRequest<State>(query), refetchInterval: 15000, refetchIntervalInBackground: false });
}

export function useGalaxyQuery(center?: [number, number], enabled = true) {
  const query = center ? `/api/galaxy?radius=2&center_x=${center[0]}&center_y=${center[1]}` : '/api/galaxy?radius=2';
  return useQuery({ queryKey: queryKeys.galaxy(center?.[0], center?.[1]), queryFn: () => apiRequest<Galaxy>(query), enabled, staleTime: 5000 });
}
