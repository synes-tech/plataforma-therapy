import { useState } from 'react';
import { useMutation } from '@tanstack/react-query';
import { callFunction } from '@shared/lib/api';
import { StandardModal } from '@shared/ui/StandardModal';
import type { ReportItem } from './AllReportsTab';

interface ReportEditModalProps {
  report: ReportItem;
  onClose: () => void;
  onSaved: () => void;
}

const SOAP_SECTIONS: Array<{ key: keyof ReportItem['content']; label: string }> = [
  { key: 'subjective', label: 'Subjetivo' },
  { key: 'objective', label: 'Objetivo' },
  { key: 'assessment', label: 'Avaliação' },
  { key: 'plan', label: 'Plano' },
];

export function ReportEditModal({ report, onClose, onSaved }: ReportEditModalProps) {
  const [content, setContent] = useState({ ...report.content });
  const [error, setError] = useState<string | null>(null);

  const saveMutation = useMutation({
    mutationFn: (approve: boolean) =>
      callFunction<{ id: string; status: string; updated_at: string }>('update-report', {
        session_note_id: report.id,
        content,
        approve,
      }),
    onSuccess: () => onSaved(),
    onError: (err: Error) => setError(err.message),
  });

  function handleFieldChange(key: keyof ReportItem['content'], value: string) {
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
        {SOAP_SECTIONS.map(({ key, label }) => (
          <div key={key}>
            <label htmlFor={`edit-${key}`} className="mb-1.5 block text-sm font-medium text-charcoal">
              {label}
            </label>
            <textarea
              id={`edit-${key}`}
              value={content[key] ?? ''}
              onChange={(e) => handleFieldChange(key, e.target.value)}
              rows={4}
              className="w-full resize-y rounded-xl border border-slate-200 bg-white px-4 py-3 text-sm text-charcoal transition-all placeholder:text-charcoal-muted/40 focus:border-primary/50 focus:outline-none focus:ring-[3px] focus:ring-primary/10"
              placeholder={`Descreva o conteúdo ${label.toLowerCase()}...`}
            />
          </div>
        ))}
      </div>
    </StandardModal>
  );
}
