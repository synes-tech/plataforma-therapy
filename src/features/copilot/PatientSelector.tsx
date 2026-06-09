import { useState } from 'react';
import { getInitials } from '@shared/lib/greeting';

export interface CopilotPatient {
  id: string;
  name: string;
  birth_date?: string | null;
  diagnoses?: string[];
}

interface PatientSelectorProps {
  patients: CopilotPatient[];
  selectedId: string | null;
  onSelect: (patient: CopilotPatient) => void;
  isLoading?: boolean;
  /** Renderização compacta para dropdown mobile (sem busca). */
  compact?: boolean;
}

export function PatientSelector({ patients, selectedId, onSelect, isLoading, compact }: PatientSelectorProps) {
  const [search, setSearch] = useState('');
  const filtered = search
    ? patients.filter((p) => p.name.toLowerCase().includes(search.toLowerCase()))
    : patients;

  return (
    <div className="flex h-full min-h-0 flex-col">
      {!compact && (
        <div className="shrink-0 px-4 pb-3 pt-4">
          <p className="mb-3 text-sm font-semibold text-charcoal">Sobre qual paciente?</p>
          <div className="relative">
            <svg
              className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-charcoal-muted/50"
              fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={1.8}
            >
              <path strokeLinecap="round" strokeLinejoin="round" d="M21 21l-4.35-4.35M17 11a6 6 0 11-12 0 6 6 0 0112 0z" />
            </svg>
            <input
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              placeholder="Buscar paciente..."
              className="w-full rounded-xl border border-slate-200 bg-white py-2 pl-9 pr-3 text-sm text-charcoal placeholder:text-charcoal-muted/50 focus:border-indigo-400 focus:outline-none focus:ring-2 focus:ring-indigo-100"
            />
          </div>
        </div>
      )}

      <div className="min-h-0 flex-1 overflow-y-auto px-2 pb-3">
        {isLoading ? (
          <div className="space-y-2 px-2">
            <div className="h-12 animate-pulse rounded-xl bg-slate-100" />
            <div className="h-12 animate-pulse rounded-xl bg-slate-100" />
          </div>
        ) : filtered.length === 0 ? (
          <p className="px-3 py-6 text-center text-sm text-charcoal-muted">Nenhum paciente encontrado.</p>
        ) : (
          <ul className="space-y-1">
            {filtered.map((patient) => {
              const isActive = patient.id === selectedId;
              return (
                <li key={patient.id}>
                  <button
                    onClick={() => onSelect(patient)}
                    className={`flex w-full items-center gap-3 rounded-xl border-l-4 px-3 py-2.5 text-left transition-colors ${
                      isActive
                        ? 'border-l-indigo-600 bg-indigo-50'
                        : 'border-l-transparent hover:bg-slate-50'
                    }`}
                  >
                    <span
                      className={`flex h-9 w-9 shrink-0 items-center justify-center rounded-full text-xs font-semibold ${
                        isActive ? 'bg-indigo-100 text-indigo-700' : 'bg-slate-100 text-charcoal-muted'
                      }`}
                    >
                      {getInitials(patient.name)}
                    </span>
                    <span className="min-w-0">
                      <span className={`block truncate text-sm ${isActive ? 'font-medium text-indigo-900' : 'text-charcoal'}`}>
                        {patient.name}
                      </span>
                      {isActive && (
                        <span className="block text-[11px] font-medium text-indigo-600">Contexto travado</span>
                      )}
                    </span>
                  </button>
                </li>
              );
            })}
          </ul>
        )}
      </div>
    </div>
  );
}
