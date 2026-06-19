import { useMutation, useQueryClient } from '@tanstack/react-query';
import { callFunction } from '@shared/lib/api';

interface ClearAlertsResponse {
  dismissed_count: number;
  message: string;
}

export function useClearDashboardAlerts() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: () => callFunction<ClearAlertsResponse>('clear-alerts', {}),
    onSuccess: () => {
      void queryClient.invalidateQueries({ queryKey: ['professional-briefing'] });
    },
  });
}
