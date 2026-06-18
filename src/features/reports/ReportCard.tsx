import type { ReportItem } from './AllReportsTab';
import { ExportPdfButton } from '@features/pdf/ExportPdfButton';

const STATUS_BADGE: Record<ReportItem['status'], { label: string; className: string }> = {
  draft: { label: 'Rascunho', className: 'bg-blue-50 text-blue-700 border-blue-100' },
  approved: { label: 'Aprovado', className: 'bg-emerald-50 text-emerald-700 border-emerald-100' },
  archived: { label: 'Arquivado', className: 'bg-slate-100 text-slate-600 border-slate-200' },
};

function formatDate(iso: string): string {
  const d = new Date(iso);
  if (Number.isNaN(d.getTime())) return '--';
  return new Intl.DateTimeFormat('pt-BR', {
    day: '2-digit',
    month: 'short',
    year: 'numeric',
    timeZone: 'America/Sao_Paulo',
  }).format(d);
}

function truncateText(text: string, max: number): string {
  if (!text) return '';
  return text.length > max ? text.slice(0, max) + '...' : text;
}

interface ReportCardProps {
  report: ReportItem;
  onEdit: () => void;
  onSummary: () => void;
}

export function ReportCard({ report, onEdit, onSummary }: ReportCardProps) {
  const badge = STATUS_BADGE[report.status];

  // Build a preview from the SOAP content
  const preview =
    truncateText(report.content.assessment, 120) ||
    truncateText(report.content.subjective, 120) ||
    truncateText(report.content.plan, 120) ||
    'Sem conteúdo';

  return (
    <article className="group relative flex flex-col overflow-hidden rounded-2xl border border-slate-100/80 bg-white/80 p-5 shadow-soft backdrop-blur-sm transition-all duration-200 hover:border-primary/20 hover:shadow-card">
      {/* Header */}
      <div className="mb-3 flex items-start justify-between gap-2">
        <div className="min-w-0">
          <h3 className="truncate text-sm font-semibold text-charcoal">
            {report.patient_name}
          </h3>
          <p className="mt-0.5 text-xs text-charcoal-muted">{formatDate(report.created_at)}</p>
        </div>
        <span className={`shrink-0 rounded-full border px-2 py-0.5 text-[10px] font-medium ${badge.className}`}>
          {badge.label}
        </span>
      </div>

      {/* Preview */}
      <p className="mb-4 flex-1 text-xs leading-relaxed text-charcoal-muted/80">
        {preview}
      </p>

      {/* Actions */}
      <div className="flex items-center gap-2">
        {/* AI Summary Button — destaque */}
        <button
          onClick={onSummary}
          className="inline-flex items-center gap-1.5 rounded-lg bg-ai-gradient px-3 py-1.5 text-xs font-medium text-white shadow-sm transition-all duration-200 hover:shadow-ai-glow active:scale-[0.97]"
          title="Gerar resumo rápido com IA"
        >
          <svg className="h-3.5 w-3.5" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
            <path strokeLinecap="round" strokeLinejoin="round" d="M9.813 15.904L9 18.75l-.813-2.846a4.5 4.5 0 00-3.09-3.09L2.25 12l2.846-.813a4.5 4.5 0 003.09-3.09L9 5.25l.813 2.846a4.5 4.5 0 003.09 3.09L15.75 12l-2.846.813a4.5 4.5 0 00-3.09 3.09z" />
          </svg>
          Resumo IA
        </button>

        {/* Edit Button */}
        <button
          onClick={onEdit}
          className="inline-flex items-center gap-1.5 rounded-lg border border-slate-200 px-3 py-1.5 text-xs font-medium text-charcoal transition-colors hover:border-primary/30 hover:bg-primary/5 hover:text-primary"
          title="Editar relatório"
        >
          <svg className="h-3.5 w-3.5" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
            <path strokeLinecap="round" strokeLinejoin="round" d="M16.862 4.487l1.687-1.688a1.875 1.875 0 112.652 2.652L10.582 16.07a4.5 4.5 0 01-1.897 1.13L6 18l.8-2.685a4.5 4.5 0 011.13-1.897l8.932-8.931z" />
          </svg>
          Editar
        </button>

        <ExportPdfButton
          patientId={report.patient_id}
          patientName={report.patient_name}
          variant="compact"
        />
      </div>

      {/* AI-generated indicator */}
      {report.ai_generated && (
        <div className="absolute right-3 top-3 opacity-0 transition-opacity group-hover:opacity-100">
          <span className="rounded-md bg-ai-50 px-1.5 py-0.5 text-[10px] font-medium text-ai">
            Gerado por IA
          </span>
        </div>
      )}
    </article>
  );
}
