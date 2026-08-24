import { useQuery } from '@tanstack/react-query';
import { ListPageSkeleton } from '@containers/loading';
import { callFunction } from '@shared/lib/api';
import { FamilySharedArtifactCard, type FamilySharedArtifact } from './FamilySharedArtifactCard';

interface FamilySharedArtifactsResponse {
  patient_id: string;
  patient_name: string;
  items: FamilySharedArtifact[];
}

export function FamilySharedArtifacts() {
  const { data, isLoading, error } = useQuery({
    queryKey: ['family-shared-artifacts'],
    queryFn: () => callFunction<FamilySharedArtifactsResponse>('get-family-shared-artifacts', {}),
    staleTime: 2 * 60_000,
  });

  const items = data?.items ?? [];

  if (isLoading) {
    return (
      <ListPageSkeleton rows={2} rowClassName="h-28 rounded-2xl" className="space-y-3" />
    );
  }

  if (error) {
    return (
      <div
        role="alert"
        className="rounded-xl border border-error/15 bg-error-light/40 px-4 py-3 text-sm text-error"
      >
        {error instanceof Error ? error.message : 'Erro ao carregar orientações compartilhadas'}
      </div>
    );
  }

  if (items.length === 0) {
    return (
      <div className="rounded-2xl border border-dashed border-slate-200 bg-white/60 px-4 py-8 text-center">
        <p className="text-sm text-charcoal-muted">Nenhuma orientação compartilhada ainda.</p>
        <p className="mt-1 text-xs text-charcoal-muted/70">
          Quando o terapeuta enviar materiais para o aplicativo, eles aparecerão aqui.
        </p>
      </div>
    );
  }

  return (
    <div className="space-y-3">
      {items.map((artifact) => (
        <FamilySharedArtifactCard key={artifact.id} artifact={artifact} />
      ))}
    </div>
  );
}
