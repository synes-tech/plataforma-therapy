import { MobileNavSelect } from '@shared/ui/MobileNavSelect';
import { classifyTabClassName } from './classify-tab.utils';

export type FinanceiroTabKey =
  | 'executivo'
  | 'recebimentos'
  | 'custos'
  | 'planos'
  | 'classificar'
  | 'extrato';

const MAIN_TABS: { id: FinanceiroTabKey; label: string }[] = [
  { id: 'executivo', label: 'Visão geral' },
  { id: 'recebimentos', label: 'Receitas' },
  { id: 'custos', label: 'Despesas' },
  { id: 'planos', label: 'Pacientes & planos' },
];

interface FinanceiroTabsProps {
  active: FinanceiroTabKey;
  onChange: (tab: FinanceiroTabKey) => void;
  pendingCount: number;
}

export function FinanceiroTabs({ active, onChange, pendingCount }: FinanceiroTabsProps) {
  const mobileOptions = [
    ...MAIN_TABS,
    { id: 'extrato' as const, label: 'Extrato' },
    { id: 'classificar' as const, label: `Sessões a classificar (${pendingCount})` },
  ];

  return (
    <>
      <MobileNavSelect
        value={active}
        options={mobileOptions.map((tab) => ({ value: tab.id, label: tab.label }))}
        onChange={onChange}
        ariaLabel="Seções do financeiro"
        className="w-full"
        dataTour="financeiro-tabs"
      />

      <nav className="hidden w-full sm:block" aria-label="Seções do financeiro">
        <div
          className="flex w-full items-stretch gap-1 rounded-xl border border-[#E4D5C8] bg-[#F0E6DC] p-1"
          role="tablist"
          data-tour="financeiro-tabs"
        >
          {MAIN_TABS.map((tab) => {
            const isActive = active === tab.id;
            return (
              <button
                key={tab.id}
                type="button"
                role="tab"
                aria-selected={isActive}
                onClick={() => onChange(tab.id)}
                className={`flex min-w-0 flex-1 items-center justify-center whitespace-nowrap rounded-lg px-3 py-2.5 text-center text-sm font-medium transition-colors ${
                  isActive ? 'bg-white text-primary shadow-sm' : 'text-charcoal-muted hover:text-charcoal'
                }`}
              >
                {tab.label}
              </button>
            );
          })}
          <button
            type="button"
            role="tab"
            aria-selected={active === 'extrato'}
            onClick={() => onChange('extrato')}
            className={`flex min-w-0 flex-1 items-center justify-center whitespace-nowrap rounded-lg px-3 py-2.5 text-center text-sm font-medium transition-colors ${
              active === 'extrato' ? 'bg-white text-primary shadow-sm' : 'text-charcoal-muted hover:text-charcoal'
            }`}
          >
            Extrato
          </button>
          <button
            type="button"
            role="tab"
            aria-selected={active === 'classificar'}
            onClick={() => onChange('classificar')}
            aria-label={`Sessões a classificar: ${pendingCount}`}
            className={`inline-flex min-w-0 flex-1 items-center justify-center gap-1.5 whitespace-nowrap rounded-lg px-3 py-2.5 text-sm font-bold ${classifyTabClassName(pendingCount, active === 'classificar')}`}
          >
            Sessões a classificar
            <span className="tabular-nums">{pendingCount}</span>
          </button>
        </div>
      </nav>
    </>
  );
}
