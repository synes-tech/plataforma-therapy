import { useState } from 'react';
import { useQuery } from '@tanstack/react-query';
import { InlineLoadingButton, ListPageSkeleton } from '@containers/loading';
import { callFunction } from '@shared/lib/api';
import { AiMarkdownContent } from '@shared/ui/AiMarkdownContent';
import { StandardModal } from '@shared/ui/StandardModal';
import { exportOrShareArtifactPdf } from '../../patient/documents/exportArtifactPdf';
import { ARTIFACT_BADGE_CONFIG } from '../../patient/documents/patient-artifacts.constants';
import {
  formatArtifactDateShort,
  resolveArtifactTitle,
  truncateArtifactPreview,
} from '../../patient/documents/patient-artifacts.format';
import type { PatientArtifact } from '../../patient/documents/patient-artifacts.types';
import type { FamilySharedArtifact } from '../shared-artifacts/FamilySharedArtifactCard';

interface FamilySharedDocumentsResponse {
  patient_id: string;
  patient_name: string;
  items: FamilySharedArtifact[];
}

export function FamilySharedDocumentsTab() {
  const [readingArtifact, setReadingArtifact] = useState<FamilySharedArtifact | null>(null);
  const [exportingId, setExportingId] = useState<string | null>(null);

  const { data, isLoading, error } = useQuery({
    queryKey: ['family-shared-artifacts'],
    queryFn: () => callFunction<FamilySharedDocumentsResponse>('get-family-shared-artifacts', {}),
    staleTime: 2 * 60_000,
  });

  const items = data?.items ?? [];

  async function handleExportPdf(artifact: FamilySharedArtifact) {
    if (!data?.patient_id) return;
    setExportingId(artifact.id);
    try {
      const asPatientArtifact: PatientArtifact = {
        id: artifact.id,
        tipo_artefato: artifact.tipo_artefato,
        titulo: artifact.titulo,
        conteudo_texto: artifact.conteudo_texto,
        criado_em: artifact.criado_em,
        is_legacy: false,
        compartilhado_familia: true,
      };
      await exportOrShareArtifactPdf(asPatientArtifact, data.patient_id, data.patient_name);
    } finally {
      setExportingId(null);
    }
  }

  if (isLoading) {
    return <ListPageSkeleton rows={3} rowClassName="h-14 rounded-xl" className="space-y-3" />;
  }

  if (error) {
    return (
      <div role="alert" className="rounded-xl border border-error/15 bg-error-light/40 px-4 py-3 text-sm text-error">
        {error instanceof Error ? error.message : 'Erro ao carregar documentos'}
      </div>
    );
  }

  if (items.length === 0) {
    return (
      <div className="rounded-2xl border border-dashed border-slate-200 bg-white/60 px-4 py-12 text-center">
        <p className="text-sm text-charcoal-muted">Nenhum documento compartilhado ainda.</p>
        <p className="mt-1 text-xs text-charcoal-muted/70">
          Planos, relatórios e orientações aparecerão aqui quando o terapeuta compartilhar.
        </p>
      </div>
    );
  }

  return (
    <>
      <div className="overflow-hidden rounded-2xl border border-slate-100 bg-white shadow-sm">
        <div className="hidden overflow-x-auto md:block">
          <table className="w-full min-w-[860px] text-left text-sm">
            <thead>
              <tr className="border-b border-slate-100 text-xs font-semibold uppercase tracking-wider text-charcoal-muted">
                <th className="w-[7.5rem] px-5 py-3">Data</th>
                <th className="px-5 py-3">Título / Resumo</th>
                <th className="w-[8.5rem] px-5 py-3">Tipo</th>
                <th className="w-[14rem] px-5 py-3 text-right">Ações</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-100">
              {items.map((artifact) => {
                const title = resolveArtifactTitle(artifact);
                const badge = ARTIFACT_BADGE_CONFIG[artifact.tipo_artefato];
                return (
                  <tr key={artifact.id} className="hover:bg-slate-50/60">
                    <td className="whitespace-nowrap px-5 py-3.5 text-charcoal-muted">
                      {formatArtifactDateShort(artifact.criado_em)}
                    </td>
                    <td className="px-5 py-3.5">
                      <p className="font-medium text-charcoal">{title}</p>
                      <p className="mt-0.5 line-clamp-1 text-xs text-charcoal-muted">
                        {truncateArtifactPreview(artifact.conteudo_texto)}
                      </p>
                    </td>
                    <td className="px-5 py-3.5">
                      <span className={`rounded-full px-2.5 py-0.5 text-xs font-semibold ring-1 ring-inset ${badge.className}`}>
                        {badge.label}
                      </span>
                    </td>
                    <td className="px-5 py-3.5 text-right">
                      <div className="flex justify-end gap-2">
                        <button
                          type="button"
                          onClick={() => setReadingArtifact(artifact)}
                          className="inline-flex h-9 items-center rounded-lg bg-charcoal px-3.5 text-xs font-semibold uppercase text-white"
                        >
                          Visualizar
                        </button>
                        <InlineLoadingButton
                          type="button"
                          loading={exportingId === artifact.id}
                          onClick={() => void handleExportPdf(artifact)}
                          className="inline-flex h-9 items-center rounded-lg border border-primary/20 bg-primary/5 px-3 text-xs font-semibold text-primary"
                        >
                          PDF
                        </InlineLoadingButton>
                      </div>
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>

        <div className="divide-y divide-slate-100 md:hidden">
          {items.map((artifact) => (
            <article key={artifact.id} className="space-y-3 px-4 py-4">
              <p className="text-xs text-charcoal-muted">{formatArtifactDateShort(artifact.criado_em)}</p>
              <p className="text-sm font-medium text-charcoal">
                {resolveArtifactTitle(artifact)}
              </p>
              <p className="line-clamp-2 text-sm text-charcoal-muted">
                {truncateArtifactPreview(artifact.conteudo_texto, 80)}
              </p>
              <div className="flex gap-2">
                <button
                  type="button"
                  onClick={() => setReadingArtifact(artifact)}
                  className="h-9 flex-1 rounded-lg bg-charcoal text-xs font-semibold uppercase text-white"
                >
                  Visualizar
                </button>
                <InlineLoadingButton
                  type="button"
                  loading={exportingId === artifact.id}
                  onClick={() => void handleExportPdf(artifact)}
                  className="h-9 rounded-lg border border-primary/20 px-3 text-xs font-semibold text-primary"
                >
                  PDF
                </InlineLoadingButton>
              </div>
            </article>
          ))}
        </div>
      </div>

      <StandardModal
        isOpen={readingArtifact !== null}
        onClose={() => setReadingArtifact(null)}
        title={
          readingArtifact
            ? resolveArtifactTitle(readingArtifact)
            : 'Documento'
        }
        size="2xl"
        footer={
          readingArtifact ? (
            <div className="flex w-full flex-col gap-2 sm:flex-row sm:justify-end">
              <InlineLoadingButton
                type="button"
                loading={exportingId === readingArtifact.id}
                onClick={() => void handleExportPdf(readingArtifact)}
                className="inline-flex h-11 items-center justify-center rounded-xl border border-primary/30 bg-primary/10 px-5 text-sm font-semibold text-primary sm:w-auto"
              >
                Exportar PDF
              </InlineLoadingButton>
              <button
                type="button"
                onClick={() => setReadingArtifact(null)}
                className="inline-flex h-11 items-center justify-center rounded-xl bg-charcoal px-5 text-sm font-semibold text-white sm:w-auto"
              >
                Fechar
              </button>
            </div>
          ) : undefined
        }
      >
        {readingArtifact ? (
          <div className="max-h-[min(60vh,32rem)] overflow-y-auto">
            <AiMarkdownContent content={readingArtifact.conteudo_texto} variant="light" />
          </div>
        ) : null}
      </StandardModal>
    </>
  );
}
