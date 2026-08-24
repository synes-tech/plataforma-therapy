import { AiMarkdownContent } from '@shared/ui/AiMarkdownContent';
import { ARTIFACT_BADGE_CONFIG } from '../../patient/documents/patient-artifacts.constants';
import { formatArtifactDateShort } from '../../patient/documents/patient-artifacts.format';

export interface FamilySharedArtifact {
  id: string;
  tipo_artefato: 'acao_recomendada' | 'resumo_proativo' | 'relatorio_sessao';
  titulo: string | null;
  conteudo_texto: string;
  criado_em: string;
}

interface FamilySharedArtifactCardProps {
  artifact: FamilySharedArtifact;
}

export function FamilySharedArtifactCard({ artifact }: FamilySharedArtifactCardProps) {
  const badge = ARTIFACT_BADGE_CONFIG[artifact.tipo_artefato];
  const dateLabel = formatArtifactDateShort(artifact.criado_em);

  return (
    <article className="overflow-hidden rounded-2xl border border-slate-100 bg-white shadow-sm">
      <header className="flex flex-wrap items-center justify-between gap-2 border-b border-slate-50 px-4 py-3">
        <span
          className={`inline-flex items-center rounded-full px-2.5 py-0.5 text-xs font-semibold ring-1 ring-inset ${badge.className}`}
        >
          {badge.label}
        </span>
        {dateLabel ? (
          <time dateTime={artifact.criado_em} className="text-xs text-charcoal-muted">
            {dateLabel}
          </time>
        ) : null}
      </header>

      <div className="px-4 py-4">
        <AiMarkdownContent content={artifact.conteudo_texto} variant="light" />
      </div>
    </article>
  );
}
