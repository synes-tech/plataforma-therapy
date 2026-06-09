import { useQuery } from '@tanstack/react-query';
import { useEffect } from 'react';
import { supabase } from '@shared/lib/supabase';

interface CrisisAlert {
  id: string;
  patient_id: string;
  crisis_level: number;
  created_at: string;
  patients: { name: string };
}

export function CrisisAlerts() {
  const { data: alerts, refetch } = useQuery({
    queryKey: ['crisis-alerts-unseen'],
    queryFn: async () => {
      const { data, error } = await supabase
        .from('crisis_alerts')
        .select('id, patient_id, crisis_level, created_at, patients(name)')
        .is('seen_at', null)
        .order('created_at', { ascending: false })
        .limit(10);

      if (error) throw error;
      return data as unknown as CrisisAlert[];
    },
  });

  // Subscribe to Realtime for new crisis alerts
  useEffect(() => {
    const channel = supabase
      .channel('crisis-alerts-realtime')
      .on(
        'postgres_changes',
        {
          event: 'INSERT',
          schema: 'public',
          table: 'crisis_alerts',
        },
        () => {
          // Refetch alerts when a new one is inserted
          refetch();
        },
      )
      .subscribe();

    return () => {
      supabase.removeChannel(channel);
    };
  }, [refetch]);

  async function markAsSeen(alertId: string) {
    await supabase
      .from('crisis_alerts')
      .update({ seen_at: new Date().toISOString() })
      .eq('id', alertId);
    refetch();
  }

  if (!alerts || alerts.length === 0) {
    return null;
  }

  return (
    <section className="mb-6" aria-label="Alertas de crise">
      <h3 className="mb-3 flex items-center gap-2 text-sm font-medium text-accent">
        <span className="inline-block h-2 w-2 animate-pulse rounded-full bg-accent" />
        Alertas de Crise ({alerts.length})
      </h3>
      <div className="space-y-2">
        {alerts.map((alert) => (
          <div
            key={alert.id}
            className="flex items-center justify-between rounded-lg border border-accent/20 bg-accent/5 px-4 py-3"
          >
            <div>
              <p className="text-sm font-medium text-text">
                {alert.patients.name}
              </p>
              <p className="mt-0.5 text-xs text-text-muted">
                Nível {alert.crisis_level}/5 •{' '}
                {new Date(alert.created_at).toLocaleDateString('pt-BR', {
                  day: '2-digit',
                  month: '2-digit',
                  hour: '2-digit',
                  minute: '2-digit',
                })}
              </p>
            </div>
            <button
              onClick={() => markAsSeen(alert.id)}
              className="rounded-lg px-3 py-1.5 text-xs text-text-muted hover:bg-surface-card hover:text-text"
              aria-label={`Marcar alerta de ${alert.patients.name} como visto`}
            >
              Visto
            </button>
          </div>
        ))}
      </div>
    </section>
  );
}
