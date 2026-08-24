import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { callFunction } from '@shared/lib/api';
import { useAuth } from '@shared/hooks/useAuth';
import type { ListClinicalAlertsResponse } from './clinical-alerts.types';
import { CLINICAL_ALERTS_POLL_MS, CLINICAL_ALERTS_QUERY_KEY } from './clinical-alerts.utils';

const TRIAGE_ROLES = new Set(['professional', 'clinic_admin', 'master']);

export function useClinicalAlerts(enabled = true) {
  const { user } = useAuth();
  const canTriage = Boolean(user && TRIAGE_ROLES.has(user.role));

  return useQuery({
    queryKey: CLINICAL_ALERTS_QUERY_KEY,
    queryFn: () => callFunction<ListClinicalAlertsResponse>('list-clinical-alerts', {}),
    enabled: enabled && canTriage,
    staleTime: 60 * 1000,
    refetchInterval: CLINICAL_ALERTS_POLL_MS,
    refetchOnWindowFocus: true,
  });
}

export function useAcknowledgeClinicalAlert() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: (alertId: string) =>
      callFunction<{ id: string; status: 'ACKNOWLEDGED' }>('acknowledge-clinical-alert', {
        alert_id: alertId,
      }),
    onSuccess: (_data, alertId) => {
      queryClient.setQueryData<ListClinicalAlertsResponse>(CLINICAL_ALERTS_QUERY_KEY, (current) => {
        if (!current) return current;
        const alerts = current.alerts.filter((item) => item.id !== alertId);
        const severeUnreadCount = alerts.filter((item) => item.severity === 'SEVERE').length;
        return {
          ...current,
          alerts,
          unread_count: alerts.length,
          severe_unread_count: severeUnreadCount,
          has_severe_unread: severeUnreadCount > 0,
        };
      });
    },
  });
}
