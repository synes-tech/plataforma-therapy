import { useMutation, useQueryClient } from '@tanstack/react-query';
import { callFunction } from '@shared/lib/api';

interface DismissAlertResponse {
  dismissed: boolean;
  diary_entry_id: string;
  message: string;
}

export function useDismissDashboardAlert() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: (diaryEntryId: string) =>
      callFunction<DismissAlertResponse>('dismiss-alert', { diary_entry_id: diaryEntryId }),
    onSuccess: () => {
      void queryClient.invalidateQueries({ queryKey: ['professional-briefing'] });
    },
  });
}
