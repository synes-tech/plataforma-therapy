interface DiagnosisChipsProps {
  diagnoses: string[];
  /** Max chips to show before collapsing into a "+N" counter. */
  max?: number;
  className?: string;
}

/** Maps a diagnosis label to a soft, color-coded pill style. */
function chipClass(label: string): string {
  const value = label.toLowerCase();
  if (value.includes('tea') || value.includes('autis')) {
    return 'bg-blue-50 text-blue-700 border-blue-100';
  }
  if (value.includes('tdah') || value.includes('atenção') || value.includes('atencao')) {
    return 'bg-amber-50 text-amber-700 border-amber-100';
  }
  if (value.includes('ansied') || value.includes('toc')) {
    return 'bg-ai-50 text-ai border-ai/15';
  }
  return 'bg-slate-50 text-slate-600 border-slate-200';
}

function Chip({ label }: { label: string }) {
  return (
    <span
      className={`inline-flex items-center rounded-md border px-2 py-1 text-xs font-medium ${chipClass(label)}`}
    >
      {label}
    </span>
  );
}

/**
 * Reusable, color-coded diagnosis pills. Wraps gracefully on small screens.
 * Reusable across the patient list and (future) patient chart.
 */
export function DiagnosisChips({ diagnoses, max, className = '' }: DiagnosisChipsProps) {
  const items = diagnoses.filter(Boolean);

  if (items.length === 0) {
    return <span className="text-sm text-charcoal-muted/70">Sem diagnóstico</span>;
  }

  const visible = max ? items.slice(0, max) : items;
  const hidden = max ? items.length - visible.length : 0;

  return (
    <div className={`flex flex-wrap items-center gap-2 ${className}`}>
      {visible.map((d) => (
        <Chip key={d} label={d} />
      ))}
      {hidden > 0 && (
        <span className="inline-flex items-center rounded-md border border-slate-200 bg-slate-50 px-2 py-1 text-xs font-medium text-charcoal-muted">
          +{hidden}
        </span>
      )}
    </div>
  );
}
