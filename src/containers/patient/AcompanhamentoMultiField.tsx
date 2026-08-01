import { useState } from 'react';
import {
  ACOMPANHAMENTO_OPTIONS,
} from './patient-anamnesis.types';
import {
  ACOMPANHAMENTO_OTHER_LABEL,
  addCustomAcompanhamento,
  getCustomAcompanhamentos,
  removeAcompanhamento,
  togglePresetAcompanhamento,
} from './acompanhamento-multi.utils';

type AcompanhamentoMultiFieldVariant = 'wizard' | 'clinical';

interface AcompanhamentoMultiFieldProps {
  value: string[];
  onChange: (next: string[]) => void;
  variant?: AcompanhamentoMultiFieldVariant;
}

function chipClasses(selected: boolean): string {
  return selected
    ? 'bg-primary-50 text-primary ring-1 ring-primary/30'
    : 'border border-slate-200 bg-white text-charcoal-muted hover:border-primary/30 hover:bg-primary/[0.03]';
}

export function AcompanhamentoMultiField({
  value,
  onChange,
  variant: _variant = 'clinical',
}: AcompanhamentoMultiFieldProps) {
  const [outroDraft, setOutroDraft] = useState('');
  const [outroOpen, setOutroOpen] = useState(false);
  const customValues = getCustomAcompanhamentos(value);

  function commitOutro() {
    const next = addCustomAcompanhamento(value, outroDraft);
    if (next.length !== value.length) {
      onChange(next);
      setOutroDraft('');
    }
  }

  const outroInputClass =
    'h-9 min-w-[10rem] flex-1 rounded-xl border border-slate-200 bg-white px-3 text-sm text-charcoal placeholder:text-charcoal-muted/40 focus:border-primary/50 focus:outline-none focus:ring-[3px] focus:ring-primary/10';

  const addButtonClass =
    'shrink-0 rounded-xl bg-primary px-3 py-1.5 text-xs font-medium text-white transition-colors hover:bg-primary/90 disabled:opacity-40';

  return (
    <div className="space-y-3">
      <div className="flex flex-wrap items-center gap-2">
        {ACOMPANHAMENTO_OPTIONS.map((option) => {
          const selected = value.includes(option);
          return (
            <button
              key={option}
              type="button"
              onClick={() => onChange(togglePresetAcompanhamento(value, option))}
              className={`min-h-[44px] rounded-full px-4 py-2 text-xs font-medium transition-all ${chipClasses(selected)}`}
            >
              {option}
            </button>
          );
        })}

        {customValues.map((custom) => (
          <button
            key={custom}
            type="button"
            onClick={() => onChange(removeAcompanhamento(value, custom))}
            className={`min-h-[44px] rounded-full px-4 py-2 text-xs font-medium transition-all ${chipClasses(true)}`}
            title="Remover tratamento personalizado"
          >
            {custom}
            <span className="ml-1 opacity-70" aria-hidden>
              ×
            </span>
          </button>
        ))}

        <button
          type="button"
          onClick={() => setOutroOpen((open) => !open)}
          className={`min-h-[44px] rounded-full px-4 py-2 text-xs font-medium transition-all ${chipClasses(outroOpen)}`}
          aria-expanded={outroOpen}
        >
          {ACOMPANHAMENTO_OTHER_LABEL}
        </button>

        {outroOpen && (
          <div className="flex w-full min-w-[12rem] flex-1 basis-[12rem] items-center gap-2 sm:w-auto">
            <input
              type="text"
              value={outroDraft}
              onChange={(event) => setOutroDraft(event.target.value)}
              onKeyDown={(event) => {
                if (event.key === 'Enter') {
                  event.preventDefault();
                  commitOutro();
                }
              }}
              placeholder="Ex.: Musicoterapia, Psicoterapia..."
              className={outroInputClass}
              maxLength={120}
              aria-label="Tratamento personalizado"
            />
            <button
              type="button"
              onClick={commitOutro}
              disabled={!outroDraft.trim()}
              className={addButtonClass}
            >
              Adicionar
            </button>
          </div>
        )}
      </div>

      {outroOpen && (
        <p className="text-[11px] text-charcoal-muted/70">
          Digite o tipo de tratamento e pressione Enter ou toque em Adicionar. Você pode incluir vários.
        </p>
      )}
    </div>
  );
}
