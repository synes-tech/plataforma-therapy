import { useMemo, useRef, useState } from 'react';
import {
  displayLabel,
  filterTaxonomy,
  groupByCategory,
  useClinicalTaxonomy,
} from './clinical-taxonomy';
import type { SelectedCondition } from './patient-anamnesis.types';

/**
 * Seleção de condições clínicas a partir da taxonomia curada.
 *
 * O texto livre continua existindo ao lado, e por um motivo clínico: 64 verbetes não cobrem
 * tudo o que aparece em consultório. Forçar o terapeuta a escolher da lista faria com que
 * ele encaixasse o paciente no rótulo mais próximo — o que é pior para o prontuário e para
 * a IA do que registrar o termo real.
 */

interface PatientConditionPickerProps {
  selected: SelectedCondition[];
  freeText: string;
  onChangeSelected: (next: SelectedCondition[]) => void;
  onChangeFreeText: (next: string) => void;
  error?: string;
  disabled?: boolean;
}

const MAX_SUGGESTIONS = 8;

export function PatientConditionPicker({
  selected,
  freeText,
  onChangeSelected,
  onChangeFreeText,
  error,
  disabled,
}: PatientConditionPickerProps) {
  const { data: taxonomy = [], isLoading, isError } = useClinicalTaxonomy();
  const [query, setQuery] = useState('');
  const [open, setOpen] = useState(false);
  const [showFreeText, setShowFreeText] = useState(() => freeText.trim().length > 0);
  const blurTimer = useRef<number | null>(null);

  const selectedIds = useMemo(() => selected.map((c) => c.id), [selected]);

  const suggestions = useMemo(
    () => filterTaxonomy(taxonomy, query, selectedIds),
    [taxonomy, query, selectedIds],
  );

  const grouped = useMemo(
    () => groupByCategory(suggestions.slice(0, MAX_SUGGESTIONS)),
    [suggestions],
  );

  function add(id: string, label: string) {
    onChangeSelected([...selected, { id, label }]);
    setQuery('');
    setOpen(false);
  }

  function remove(id: string) {
    onChangeSelected(selected.filter((c) => c.id !== id));
  }

  // O blur precisa de um respiro para que o clique numa sugestão registre antes da lista sumir.
  function handleBlur() {
    blurTimer.current = window.setTimeout(() => setOpen(false), 120);
  }
  function handleFocus() {
    if (blurTimer.current) window.clearTimeout(blurTimer.current);
    setOpen(true);
  }

  return (
    <div>
      <label htmlFor="condicao-busca" className="mb-1.5 block text-sm font-medium text-charcoal">
        Condições e focos clínicos *
      </label>

      {selected.length > 0 && (
        <ul className="mb-2 flex flex-wrap gap-1.5" aria-label="Condições selecionadas">
          {selected.map((condition) => (
            <li key={condition.id}>
              <span className="inline-flex items-center gap-1.5 rounded-full bg-primary-50 py-1 pl-3 pr-1.5 text-xs font-medium text-primary ring-1 ring-primary/20">
                {condition.label}
                <button
                  type="button"
                  onClick={() => remove(condition.id)}
                  disabled={disabled}
                  aria-label={`Remover ${condition.label}`}
                  className="flex h-4 w-4 items-center justify-center rounded-full text-primary/70 transition-colors hover:bg-primary/15 hover:text-primary"
                >
                  <svg className="h-3 w-3" viewBox="0 0 20 20" fill="currentColor" aria-hidden>
                    <path d="M6.3 6.3a1 1 0 011.4 0L10 8.6l2.3-2.3a1 1 0 111.4 1.4L11.4 10l2.3 2.3a1 1 0 01-1.4 1.4L10 11.4l-2.3 2.3a1 1 0 01-1.4-1.4L8.6 10 6.3 7.7a1 1 0 010-1.4z" />
                  </svg>
                </button>
              </span>
            </li>
          ))}
        </ul>
      )}

      <div className="relative">
        <input
          id="condicao-busca"
          type="text"
          role="combobox"
          aria-expanded={open}
          aria-controls="condicao-sugestoes"
          autoComplete="off"
          className="h-11 w-full rounded-xl border border-slate-200 bg-white px-4 text-sm text-charcoal placeholder:text-charcoal-muted/40 transition-all focus:border-primary/50 focus:outline-none focus:ring-[3px] focus:ring-primary/10"
          value={query}
          disabled={disabled || isLoading}
          onChange={(e) => {
            setQuery(e.target.value);
            setOpen(true);
          }}
          onFocus={handleFocus}
          onBlur={handleBlur}
          placeholder={isLoading ? 'Carregando catálogo...' : 'Buscar: TEA, ansiedade, luto, burnout...'}
        />

        {open && !isLoading && (
          <div
            id="condicao-sugestoes"
            className="absolute left-0 right-0 top-full z-20 mt-1 max-h-64 overflow-y-auto rounded-xl border border-slate-200 bg-white py-1 shadow-lg"
          >
            {grouped.length === 0 ? (
              <p className="px-3 py-3 text-xs text-charcoal-muted">
                Nada encontrado para “{query}”. Use o campo de texto livre abaixo para registrar
                com suas palavras.
              </p>
            ) : (
              grouped.map((group) => (
                <div key={group.category}>
                  <p className="px-3 pb-1 pt-2 text-[10px] font-semibold uppercase tracking-wider text-charcoal-muted">
                    {group.label}
                  </p>
                  {group.items.map((entry) => (
                    <button
                      key={entry.id}
                      type="button"
                      onMouseDown={(e) => e.preventDefault()}
                      onClick={() => add(entry.id, displayLabel(entry))}
                      className="block w-full px-3 py-2 text-left transition-colors hover:bg-primary-50"
                    >
                      <span className="block text-sm text-charcoal">{displayLabel(entry)}</span>
                      {entry.short_label && entry.short_label !== entry.label && (
                        <span className="block text-[11px] text-charcoal-muted">{entry.label}</span>
                      )}
                    </button>
                  ))}
                </div>
              ))
            )}
          </div>
        )}
      </div>

      {isError && (
        <p className="mt-1.5 text-xs text-charcoal-muted">
          Não foi possível carregar o catálogo. Você pode registrar em texto livre abaixo.
        </p>
      )}

      {showFreeText || freeText.trim() ? (
        <div className="mt-3">
          <label htmlFor="condicao-livre" className="mb-1.5 block text-xs font-medium text-charcoal-muted">
            Outras condições, com suas palavras (separadas por vírgula)
          </label>
          <input
            id="condicao-livre"
            className="h-11 w-full rounded-xl border border-slate-200 bg-white px-4 text-sm text-charcoal placeholder:text-charcoal-muted/40 transition-all focus:border-primary/50 focus:outline-none focus:ring-[3px] focus:ring-primary/10"
            value={freeText}
            disabled={disabled}
            onChange={(e) => onChangeFreeText(e.target.value)}
            placeholder="Ex.: hipótese de TEA a confirmar"
          />
        </div>
      ) : (
        <button
          type="button"
          onClick={() => setShowFreeText(true)}
          className="mt-2 text-xs font-medium text-primary transition-colors hover:text-primary/80"
        >
          + Registrar uma condição que não está no catálogo
        </button>
      )}

      {error && (
        <p className="mt-1.5 text-xs text-error" role="alert">
          {error}
        </p>
      )}
    </div>
  );
}
