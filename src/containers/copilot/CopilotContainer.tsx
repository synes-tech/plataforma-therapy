import { useParams } from 'react-router-dom';
import { useQuery } from '@tanstack/react-query';
import { PageLoader } from '@containers/loading';
import { supabase } from '@shared/lib/supabase';
import { CopilotChat } from '@features/ai-chat/CopilotChat';
import { EvolutionChart } from '@features/dashboard/EvolutionChart';

export default function CopilotContainer() {
  const { patientId } = useParams<{ patientId: string }>();

  const { data: patient, isLoading } = useQuery({
    queryKey: ['patient-detail', patientId],
    queryFn: async () => {
      const { data, error } = await supabase
        .from('patients')
        .select('id, name, diagnoses, birth_date')
        .eq('id', patientId!)
        .is('deleted_at', null)
        .single();
      if (error) throw error;
      return data as { id: string; name: string; diagnoses: string[]; birth_date: string };
    },
    enabled: !!patientId,
  });

  if (!patientId) {
    return <PageLoader label="Paciente não encontrado" />;
  }

  if (isLoading) {
    return <PageLoader label="Carregando copiloto..." />;
  }

  if (!patient) {
    return (
      <div className="flex min-h-dvh items-center justify-center bg-surface">
        <p className="text-text-muted">Paciente não encontrado</p>
      </div>
    );
  }

  return (
    <div className="min-h-dvh bg-surface p-4 lg:p-8">
      {/* Header */}
      <header className="mb-6">
        <div className="flex items-center gap-3">
          <div className="flex h-10 w-10 items-center justify-center rounded-full bg-ai/20">
            <span className="text-lg">🧠</span>
          </div>
          <div>
            <h1 className="text-lg font-semibold text-text">
              Copiloto — {patient.name}
            </h1>
            <p className="text-xs text-text-muted">
              {patient.diagnoses.join(' • ')}
            </p>
          </div>
        </div>
      </header>

      {/* Main layout */}
      <div className="grid gap-6 lg:grid-cols-3">
        {/* Left: Chat (takes 2 cols on large) */}
        <div className="lg:col-span-2">
          <CopilotChat patientId={patientId} patientName={patient.name} />
        </div>

        {/* Right: Context panel */}
        <aside className="space-y-4">
          {/* Evolution chart */}
          <EvolutionChart patientId={patientId} patientName={patient.name} />

          {/* Quick info */}
          <div className="glass-card p-4">
            <h4 className="text-xs font-medium text-text-muted">Informações Rápidas</h4>
            <div className="mt-3 space-y-2">
              <InfoRow label="Diagnósticos" value={patient.diagnoses.join(', ')} />
              <InfoRow
                label="Idade"
                value={`${Math.floor((Date.now() - new Date(patient.birth_date).getTime()) / (365.25 * 24 * 60 * 60 * 1000))} anos`}
              />
            </div>
          </div>

          {/* Disclaimer */}
          <div className="rounded-lg border border-surface-border bg-surface-card/50 p-3">
            <p className="text-[10px] text-text-muted">
              ⚠️ O copiloto é uma ferramenta de auxílio. Todas as sugestões devem ser validadas pelo profissional. A IA não diagnostica e não sugere medicações.
            </p>
          </div>
        </aside>
      </div>
    </div>
  );
}

function InfoRow({ label, value }: { label: string; value: string }) {
  return (
    <div className="flex items-baseline justify-between">
      <span className="text-xs text-text-muted">{label}</span>
      <span className="text-xs font-medium text-text">{value}</span>
    </div>
  );
}
