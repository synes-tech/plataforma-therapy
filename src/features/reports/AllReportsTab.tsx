import { useState } from 'react';
import { useQuery, useQueryClient } from '@tanstack/react-query';
import { callFunction } from '@shared/lib/api';
import { StandardModal } from '@shared/ui/StandardModal';
import { ReportCard } from './ReportCard';
import { ReportEditModal } from './ReportEditModal';
import { ReportSummaryPanel } from './ReportSummaryPanel';

export interface ReportItem {
  id: string;
  patient_id: string;
  patient_name: string;
  status: 'draft' | 'approved' | 'archived';
  content: {
    subjective: string;
    objective: string;
    assessment: string;
    plan: string;
  };
  ai_generated: boolean;
  created_at: string;
  updated_at: string;
  approved_at: string | null;
}

interface ReportsData {
  items: ReportItem[];
  pagination: {
    page: number;
    per_page: number;
    total: number;
    total_pages: number;
  };
}

type StatusFilter = 'all' | 'draft' | 'approved' | 'archived';

const STATUS_OPTIONS: { value: StatusFilter; label: string }[] = [
  { value: 'all', label: 'Todos' },
  { value: 'draft', label: 'Rascunhos' },
  { value: 'approved', label: 'Aprovados' },
  { value: 'archived', label: 'Arquivados' },
];

export function AllReportsTab() {
  const queryClient = useQueryClient();
  const [page, setPage] = useState(1);
  const [statusFilter, setStatusFilter] = useState<StatusFilter>('all');
  const [editingReport, setEditingReport] = useState<ReportItem | null>(null);
  const [summaryReport, setSummaryReport] = useState<ReportItem | null>(null);

  const { data, isLoading, error } = useQuery({
    queryKey: ['all-reports', page, statusFilter],
    queryFn: () =>
      callFunction<ReportsData>('list-all-reports', {
        page,
        per_page: 20,
        status: statusFilter,
      }),
  });

  const items = data?.items ?? [];
  const pagination = data?.pagination ?? { page: 1, per_page: 20, total: 0, total_pages: 0 };

  function handleEdit(report: ReportItem) {
    setEditingReport(report);
  }

  function handleSummary(report: ReportItem) {
    setSummaryReport(report);
  }

  function handleSaved() {
    setEditingReport(null);
    queryClient.invalidateQueries({ queryKey: ['all-reports'] });
  }

  return (
    <div>
      {/* Filters */}
      <div className="mb-6 flex flex-wrap items-center gap-3">
        <div className="flex gap-1 rounded-lg border border-slate-100 bg-white p-1 shadow-sm">
          {STATUS_OPTIONS.map((opt) => (
            <button
              key={opt.value}
              onClick={() => { setStatusFilter(opt.value); setPage(1); }}
              className={`rounded-md px-3 py-1.5 text-xs font-medium transition-all ${
                statusFilter === opt.value
                  ? 'bg-charcoal text-white shadow-sm'
                  : 'text-charcoal-muted hover:bg-slate-50 hover:text-charcoal'
              }`}
            >
              {opt.label}
            </button>
          ))}
        </div>
        {pagination.total > 0 && (
          <span className="text-xs text-charcoal-muted">
            {pagination.total} relatório{pagination.total !== 1 ? 's' : ''}
          </span>
        )}
      </div>

      {/* Error */}
      {error && (
        <div role="alert" className="mb-6 rounded-xl border border-error/10 bg-error-light/50 px-4 py-3 text-sm text-error">
          Não foi possível carregar os relatórios. Tente novamente.
        </div>
      )}

      {/* Loading */}
      {isLoading && (
        <div className="grid gap-4 md:grid-cols-2 xl:grid-cols-3">
          {Array.from({ length: 6 }).map((_, i) => (
            <div key={i} className="h-48 animate-pulse rounded-2xl bg-white/60 border border-slate-100" />
          ))}
        </div>
      )}

      {/* Empty state */}
      {!isLoading && items.length === 0 && (
        <div className="rounded-2xl border border-slate-100 bg-white px-8 py-16 text-center shadow-sm">
          <div className="mx-auto mb-4 flex h-14 w-14 items-center justify-center rounded-full bg-slate-50">
            <svg className="h-7 w-7 text-charcoal-muted" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={1.5}>
              <path strokeLinecap="round" strokeLinejoin="round" d="M9 12h6m-6 4h6m2 5H7a2 2 0 01-2-2V5a2 2 0 012-2h5.586a1 1 0 01.707.293l5.414 5.414a1 1 0 01.293.707V19a2 2 0 01-2 2z" />
            </svg>
          </div>
          <p className="font-serif text-lg text-charcoal">Nenhum relatório encontrado</p>
          <p className="mt-1 text-sm text-charcoal-muted">
            {statusFilter !== 'all'
              ? 'Tente mudar o filtro de status.'
              : 'Os relatórios aparecem aqui após ditar evoluções de sessão.'}
          </p>
        </div>
      )}

      {/* Report cards grid */}
      {!isLoading && items.length > 0 && (
        <div className="grid gap-4 md:grid-cols-2 xl:grid-cols-3">
          {items.map((report) => (
            <ReportCard
              key={report.id}
              report={report}
              onEdit={() => handleEdit(report)}
              onSummary={() => handleSummary(report)}
            />
          ))}
        </div>
      )}

      {/* Pagination */}
      {pagination.total_pages > 1 && (
        <div className="mt-8 flex items-center justify-center gap-2">
          <button
            onClick={() => setPage((p) => Math.max(1, p - 1))}
            disabled={page <= 1}
            className="rounded-lg border border-slate-200 px-3 py-1.5 text-xs font-medium text-charcoal transition-colors hover:bg-slate-50 disabled:cursor-not-allowed disabled:opacity-40"
          >
            Anterior
          </button>
          <span className="text-xs text-charcoal-muted">
            Página {pagination.page} de {pagination.total_pages}
          </span>
          <button
            onClick={() => setPage((p) => Math.min(pagination.total_pages, p + 1))}
            disabled={page >= pagination.total_pages}
            className="rounded-lg border border-slate-200 px-3 py-1.5 text-xs font-medium text-charcoal transition-colors hover:bg-slate-50 disabled:cursor-not-allowed disabled:opacity-40"
          >
            Próxima
          </button>
        </div>
      )}

      {/* Edit Modal */}
      {editingReport && (
        <ReportEditModal
          report={editingReport}
          onClose={() => setEditingReport(null)}
          onSaved={handleSaved}
        />
      )}

      {/* AI Summary Panel */}
      {summaryReport && (
        <StandardModal
          isOpen={!!summaryReport}
          onClose={() => setSummaryReport(null)}
          title={`Resumo IA — ${summaryReport.patient_name}`}
          size="lg"
        >
          <ReportSummaryPanel
            report={summaryReport}
            onClose={() => setSummaryReport(null)}
          />
        </StandardModal>
      )}
    </div>
  );
}
