import { useMutation, useQueryClient } from '@tanstack/react-query';
import { apiRequest } from './client';
import { queryKeys } from './queries';
import type { ActionName, TravelPreview } from '../types/game';

export function useGameMutation(planetId?: string | null) {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: ({ action, body }: { action: ActionName; body: Record<string, unknown> }) => apiRequest<Record<string, TravelPreview> | Record<string, unknown>>(`/api/${action}`, { method: 'POST', headers: { 'content-type': 'application/json' }, body: JSON.stringify(body) }),
    onSuccess: (_result, variables) => {
      if (variables.action !== 'travel-preview') void queryClient.invalidateQueries({ queryKey: queryKeys.state(planetId) });
      if (variables.action === 'travel') void queryClient.invalidateQueries({ queryKey: ['galaxy'] });
    },
  });
}
