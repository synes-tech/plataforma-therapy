import { useState } from 'react';
import { PatientCopilotChat } from './copilot/PatientCopilotChat';
import { PatientCopilotContextBadge } from './copilot/PatientCopilotContextBadge';
import { PlanSidebar, type PlanItem } from '@features/copilot/PlanSidebar';
import { StandardModal } from '@shared/ui/StandardModal';
import { usePaywall } from '@containers/paywall';

interface PatientCopilotTabProps {
  patientId: string;
  patientName: string;
}

export function PatientCopilotTab({ patientId, patientName }: PatientCopilotTabProps) {
  const { interceptAiFeature, handlePaymentRequired } = usePaywall();
  const [planItems, setPlanItems] = useState<PlanItem[]>([]);
  const [planSheetOpen, setPlanSheetOpen] = useState(false);

  function handleRemoveFromPlan(id: string) {
    setPlanItems((prev) => prev.filter((i) => i.id !== id));
  }

  return (
    <div className="flex h-[calc(100dvh-14rem)] min-h-[28rem] flex-col overflow-hidden rounded-2xl border border-slate-100 bg-white shadow-sm lg:h-[calc(100dvh-12rem)]">
      <div className="flex shrink-0 flex-wrap items-center justify-between gap-3 border-b border-slate-100 px-4 py-3">
        <div className="flex min-w-0 flex-1 flex-col gap-2 sm:flex-row sm:items-center">
          <p className="text-sm font-medium text-charcoal lg:hidden">
            Copiloto · {patientName.split(' ')[0]}
          </p>
          <PatientCopilotContextBadge patientName={patientName} />
        </div>
        <button
          type="button"
          onClick={() => setPlanSheetOpen(true)}
          className="relative inline-flex shrink-0 items-center gap-1.5 rounded-lg border border-slate-200 px-3 py-1.5 text-xs font-medium text-charcoal lg:hidden"
        >
          Plano
          {planItems.length > 0 && (
            <span className="flex h-5 min-w-[1.25rem] items-center justify-center rounded-full bg-indigo-600 px-1 text-[10px] font-semibold text-white">
              {planItems.length}
            </span>
          )}
        </button>
      </div>

      <div className="flex min-h-0 flex-1">
        <main className="flex min-h-0 min-w-0 flex-1 flex-col">
          <PatientCopilotChat
            key={patientId}
            patientId={patientId}
            patientName={patientName}
            onBeforeSend={() => {
              let allowed = false;
              interceptAiFeature(() => {
                allowed = true;
              });
              return allowed;
            }}
            onPaymentRequired={handlePaymentRequired}
          />
        </main>

        <aside className="hidden w-72 shrink-0 flex-col border-l border-slate-100 lg:flex xl:w-80">
          <PlanSidebar patientName={patientName} items={planItems} onRemove={handleRemoveFromPlan} />
        </aside>
      </div>

      <StandardModal
        isOpen={planSheetOpen}
        onClose={() => setPlanSheetOpen(false)}
        title="Plano de Sessão"
        size="md"
      >
        <div className="h-[60dvh]">
          <PlanSidebar patientName={patientName} items={planItems} onRemove={handleRemoveFromPlan} />
        </div>
      </StandardModal>
    </div>
  );
}
