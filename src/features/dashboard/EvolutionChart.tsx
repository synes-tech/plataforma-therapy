import { useQuery } from '@tanstack/react-query';
import { supabase } from '@shared/lib/supabase';

interface WeeklyData {
  week_start: string;
  avg_mood: number;
  avg_sleep: number;
  crisis_count: number;
}

interface EvolutionChartProps {
  patientId: string;
  patientName: string;
}

export function EvolutionChart({ patientId, patientName }: EvolutionChartProps) {
  const { data: evolution, isLoading } = useQuery({
    queryKey: ['patient-evolution', patientId],
    queryFn: async () => {
      const { data, error } = await supabase
        .from('patient_evolution_weekly')
        .select('week_start, avg_mood, avg_sleep, crisis_count')
        .eq('patient_id', patientId)
        .order('week_start', { ascending: true })
        .limit(12);

      if (error) throw error;
      return data as WeeklyData[];
    },
  });

  if (isLoading) {
    return <div className="shimmer h-48 rounded-lg" />;
  }

  if (!evolution || evolution.length === 0) {
    return (
      <div className="glass-card flex h-48 items-center justify-center">
        <p className="text-sm text-text-muted">Dados insuficientes para gráfico</p>
      </div>
    );
  }

  // Simple bar chart using CSS (no chart library needed for MVP)
  const maxCrisis = Math.max(...evolution.map((w) => w.crisis_count), 1);

  return (
    <div className="glass-card p-4">
      <h4 className="mb-4 text-sm font-medium text-text">
        Evolução — {patientName}
      </h4>

      {/* Mood trend */}
      <div className="mb-4">
        <p className="mb-2 text-xs text-text-muted">Humor médio semanal</p>
        <div className="flex items-end gap-1">
          {evolution.map((week) => (
            <div key={week.week_start} className="flex flex-1 flex-col items-center gap-1">
              <div
                className="w-full rounded-sm bg-primary/60 transition-all"
                style={{ height: `${(week.avg_mood / 5) * 60}px` }}
                title={`${week.avg_mood}/5`}
              />
              <span className="text-[8px] text-text-muted">
                {new Date(week.week_start).toLocaleDateString('pt-BR', { day: '2-digit', month: '2-digit' })}
              </span>
            </div>
          ))}
        </div>
      </div>

      {/* Crisis count */}
      <div>
        <p className="mb-2 text-xs text-text-muted">Crises por semana</p>
        <div className="flex items-end gap-1">
          {evolution.map((week) => (
            <div key={week.week_start} className="flex flex-1 flex-col items-center gap-1">
              <div
                className={`w-full rounded-sm transition-all ${
                  week.crisis_count > 0 ? 'bg-accent/60' : 'bg-surface-border'
                }`}
                style={{ height: `${Math.max((week.crisis_count / maxCrisis) * 40, 4)}px` }}
                title={`${week.crisis_count} crises`}
              />
            </div>
          ))}
        </div>
      </div>
    </div>
  );
}
