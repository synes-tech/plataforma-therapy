import { useState } from 'react';

export interface PlanItem {
  id: string;
  title: string;
  content: string;
}

interface PlanSidebarProps {
  patientName?: string;
  items: PlanItem[];
  onRemove: (id: string) => void;
}

export function PlanSidebar({ patientName, items, onRemove }: PlanSidebarProps) {
  const [sent, setSent] = useState(false);

  function handleGenerate() {
    // Monta um resumo textual do plano e abre a caixa de impressão/salvar como PDF.
    const lines = items
      .map((it, i) => `${i + 1}. ${it.title}\n${it.content}`)
      .join('\n\n');
    const win = window.open('', '_blank');
    if (win) {
      win.document.write(
        `<pre style="font-family:ui-sans-serif,system-ui;white-space:pre-wrap;padding:32px;line-height:1.5">` +
          `Plano de Sessão${patientName ? ' — ' + patientName : ''}\n\n${lines}</pre>`,
      );
      win.document.close();
      win.print();
    }
    setSent(true);
    setTimeout(() => setSent(false), 2500);
  }

  return (
    <div className="flex h-full min-h-0 flex-col">
      <div className="shrink-0 px-4 pb-3 pt-4">
        <h3 className="text-sm font-semibold text-charcoal">Plano de Sessão</h3>
        <p className="mt-0.5 text-xs text-charcoal-muted">
          {items.length === 0 ? 'Salve sugestões da IA aqui.' : `${items.length} item(ns) no plano`}
        </p>
      </div>

      <div className="min-h-0 flex-1 overflow-y-auto px-4">
        {items.length === 0 ? (
          <div className="flex h-full flex-col items-center justify-center text-center">
            <div className="mb-3 flex h-11 w-11 items-center justify-center rounded-full bg-slate-50 text-charcoal-muted/40">
              <svg className="h-5 w-5" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={1.5}>
                <path strokeLinecap="round" strokeLinejoin="round" d="M9 5H7a2 2 0 00-2 2v12a2 2 0 002 2h10a2 2 0 002-2V7a2 2 0 00-2-2h-2M9 5a2 2 0 002 2h2a2 2 0 002-2M9 5a2 2 0 012-2h2a2 2 0 012 2m-6 9l2 2 4-4" />
              </svg>
            </div>
            <p className="max-w-[12rem] text-xs text-charcoal-muted">
              Quando a IA sugerir algo bom, toque em "Salvar no plano".
            </p>
          </div>
        ) : (
          <ul className="space-y-2.5 pb-2">
            {items.map((item) => (
              <li key={item.id} className="rounded-xl border border-slate-100 bg-slate-50 p-3">
                <div className="flex items-start justify-between gap-2">
                  <p className="text-sm font-medium text-charcoal">{item.title}</p>
                  <button
                    onClick={() => onRemove(item.id)}
                    aria-label="Remover do plano"
                    className="shrink-0 rounded-md p-1 text-charcoal-muted/50 transition-colors hover:bg-white hover:text-error"
                  >
                    <svg className="h-3.5 w-3.5" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                      <path strokeLinecap="round" strokeLinejoin="round" d="M6 18L18 6M6 6l12 12" />
                    </svg>
                  </button>
                </div>
                <p className="mt-1 line-clamp-3 text-xs leading-relaxed text-charcoal-muted">{item.content}</p>
              </li>
            ))}
          </ul>
        )}
      </div>

      <div className="shrink-0 border-t border-slate-100 p-4">
        <button
          onClick={handleGenerate}
          disabled={items.length === 0}
          className="flex w-full items-center justify-center gap-2 rounded-xl bg-indigo-600 px-4 py-2.5 text-sm font-medium text-white shadow-sm transition-all hover:bg-indigo-700 active:scale-[0.98] disabled:cursor-not-allowed disabled:opacity-40"
        >
          {sent ? '✓ Plano gerado' : 'Gerar PDF / Enviar para Família'}
        </button>
      </div>
    </div>
  );
}
