import { ARTIFACT_BADGE_CONFIG } from './patient-artifacts.constants';
import { PatientArtifactActions } from './PatientArtifactActions';
import {
  buildArtifactTitle,
  formatArtifactDateShort,
  truncateArtifactPreview,
} from './patient-artifacts.format';
import type { PatientArtifact } from './patient-artifacts.types';

interface PatientArtifactsTableProps {
  items: PatientArtifact[];
  onRead: (artifact: PatientArtifact) => void;
  onExportPdf: (artifact: PatientArtifact) => void;
  onRequestDelete: (artifact: PatientArtifact) => void;
  exportingId: string | null;
  deletingId: string | null;
}

function ArtifactTypeBadge({ tipo }: { tipo: PatientArtifact['tipo_artefato'] }) {
  const badge = ARTIFACT_BADGE_CONFIG[tipo];
  return (
    <span
      className={`inline-flex shrink-0 items-center rounded-full px-2.5 py-0.5 text-xs font-semibold ring-1 ring-inset ${badge.className}`}
    >
      {badge.label}
    </span>
  );
}

export function PatientArtifactsTable({
  items,
  onRead,
  onExportPdf,
  onRequestDelete,
  exportingId,
  deletingId,
}: PatientArtifactsTableProps) {
  return (
    <>
      <div className="hidden overflow-x-auto md:block">
        <table className="w-full min-w-[860px] text-left text-sm">
          <thead>
            <tr className="border-b border-slate-100 text-xs font-semibold uppercase tracking-wider text-charcoal-muted">
              <th className="w-[7.5rem] px-5 py-3 font-semibold">Data</th>
              <th className="px-5 py-3 font-semibold">Título / Resumo</th>
              <th className="w-[8.5rem] px-5 py-3 font-semibold">Tipo</th>
              <th className="w-[17rem] px-5 py-3 text-right font-semibold">Ações</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-slate-100">
            {items.map((artifact) => {
              const title = buildArtifactTitle(artifact.tipo_artefato, artifact.criado_em);
              const preview = truncateArtifactPreview(artifact.conteudo_texto);
              const dateShort = formatArtifactDateShort(artifact.criado_em);

              return (
                <tr key={artifact.id} className="transition-colors hover:bg-slate-50/60">
                  <td className="whitespace-nowrap px-5 py-3.5 text-charcoal-muted">
                    <time dateTime={artifact.criado_em}>{dateShort || '—'}</time>
                  </td>
                  <td className="px-5 py-3.5">
                    <p className="font-medium text-charcoal">{title}</p>
                    <p className="mt-0.5 line-clamp-1 text-xs text-charcoal-muted">{preview}</p>
                  </td>
                  <td className="px-5 py-3.5">
                    <ArtifactTypeBadge tipo={artifact.tipo_artefato} />
                  </td>
                  <td className="px-5 py-3.5 text-right">
                    <div className="flex justify-end">
                      <PatientArtifactActions
                        artifact={artifact}
                        onView={onRead}
                        onExportPdf={onExportPdf}
                        onRequestDelete={onRequestDelete}
                        exportingId={exportingId}
                        deletingId={deletingId}
                        layout="table"
                      />
                    </div>
                  </td>
                </tr>
              );
            })}
          </tbody>
        </table>
      </div>

      <div className="divide-y divide-slate-100 md:hidden">
        {items.map((artifact) => {
          const dateShort = formatArtifactDateShort(artifact.criado_em);
          const preview = truncateArtifactPreview(artifact.conteudo_texto, 40);

          return (
            <article key={artifact.id} className="space-y-3 px-4 py-4">
              <div className="flex flex-wrap items-center gap-2">
                <time
                  dateTime={artifact.criado_em}
                  className="text-xs font-medium text-charcoal-muted"
                >
                  {dateShort || '—'}
                </time>
                <ArtifactTypeBadge tipo={artifact.tipo_artefato} />
              </div>
              <p className="line-clamp-2 text-sm text-charcoal">{preview}</p>
              <PatientArtifactActions
                artifact={artifact}
                onView={onRead}
                onExportPdf={onExportPdf}
                onRequestDelete={onRequestDelete}
                exportingId={exportingId}
                deletingId={deletingId}
                layout="table"
              />
            </article>
          );
        })}
      </div>
    </>
  );
}
