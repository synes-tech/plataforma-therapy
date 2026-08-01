import { useState } from 'react';
import { useMutation } from '@tanstack/react-query';
import { callFunction } from '@shared/lib/api';
import { StandardModal } from '@shared/ui/StandardModal';
import {
  getReportSectionValue,
  PSYCH_REPORT_SECTIONS,
  type PsychReportSectionKey,
} from '@containers/patient/session/session-report-sections';
import type { ReportItem } from './AllReportsTab';

interface ReportEditModalProps {
  report: ReportItem;
  onClose: () => void;
  onSaved: () => void;
}

type EditableContent = ReportItem['content'];

function buildInitialContent(report: ReportItem): EditableContent {
  const next: EditableContent = { ...report.content };
  for (const section of PSYCH_REPORT_SECTIONS) {
    next[section.key] = getReportSectionValue(report.content, section);
  }
  return next;
}

export function ReportEditModal({ report, onClose, onSaved }: ReportEditModalProps) {
  const [content, setContent] = useState<EditableContent>(() => buildInitialContent(report));
  const [error, setError] = useState<string | null>(null);

  const saveMutation = useMutation({
    mutationFn: (approve: boolean) =>
      callFunction<{ id: string; status: string; updated_at: string }>('update-report', {
        session_note_id: report.id,
        content: {
          ...content,
          // espelha legado para consumidores antigos
          subjective: content.patient_reports ?? content.subjective,
          objective: content.clinical_synthesis ?? content.objective,
          assessment: content.clinical_observations ?? content.assessment,
          plan: content.management_next_steps ?? content.plan,
        },
        approve,
      }),
    onSuccess: () => onSaved(),
    onError: (err: Error) => setError(err.message),
  });

  function handleFieldChange(key: PsychReportSectionKey, value: string) {
    setContent((prev) => ({ ...prev, [key]: value }));
  }

  return (
    <StandardModal
      isOpen
      onClose={onClose}
      title={`Editar — ${report.patient_name}`}
      size="xl"
      footer={
        <>
          <button
            type="button"
            onClick={onClose}
            disabled={saveMutation.isPending}
            className="rounded-xl border border-slate-200 px-4 py-2.5 text-sm font-medium text-charcoal transition-colors hover:bg-slate-50"
          >
            Cancelar
          </button>
          <button
            type="button"
            onClick={() => saveMutation.mutate(false)}
            disabled={saveMutation.isPending}
            className="rounded-xl border border-slate-200 px-4 py-2.5 text-sm font-medium text-charcoal transition-colors hover:bg-slate-50 disabled:opacity-50"
          >
            {saveMutation.isPending ? 'Salvando...' : 'Salvar rascunho'}
          </button>
          <button
            type="button"
            onClick={() => saveMutation.mutate(true)}
            disabled={saveMutation.isPending}
            className="rounded-xl bg-primary px-4 py-2.5 text-sm font-medium text-white shadow-sm transition-all hover:bg-primary-dark active:scale-[0.98] disabled:opacity-50"
          >
            {saveMutation.isPending ? 'Aprovando...' : 'Aprovar'}
          </button>
        </>
      }
    >
      {error && (
        <div role="alert" className="mb-4 rounded-xl border border-error/10 bg-error-light/50 px-4 py-3 text-sm text-error">
          {error}
        </div>
      )}

      <div className="space-y-4">
        {PSYCH_REPORT_SECTIONS.map((section) => (
          <div key={section.key}>
            <label htmlFor={`edit-${section.key}`} className="mb-1.5 block text-sm font-medium text-charcoal">
              {section.label}
            </label>
            <textarea
              id={`edit-${section.key}`}
              value={content[section.key] ?? ''}
              onChange={(e) => handleFieldChange(section.key, e.target.value)}
              rows={4}
              className="w-full resize-y rounded-xl border border-slate-200 bg-white px-4 py-3 text-sm text-charcoal transition-all placeholder:text-charcoal-muted/40 focus:border-primary/50 focus:outline-none focus:ring-[3px] focus:ring-primary/10"
              placeholder={`Descreva ${section.label.toLowerCase()}...`}
            />
          </div>
        ))}
      </div>
    </StandardModal>
  );
}
