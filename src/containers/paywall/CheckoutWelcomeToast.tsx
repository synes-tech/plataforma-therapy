interface CheckoutWelcomeToastProps {
  visible: boolean;
  onDismiss: () => void;
}

export function CheckoutWelcomeToast({ visible, onDismiss }: CheckoutWelcomeToastProps) {
  if (!visible) return null;

  return (
    <div
      role="status"
      className="fixed bottom-6 left-1/2 z-[210] w-[min(100%,24rem)] -translate-x-1/2"
    >
      <div className="flex items-start gap-3 rounded-2xl border border-primary/20 bg-charcoal px-5 py-4 shadow-2xl shadow-black/30">
        <div className="flex h-9 w-9 shrink-0 items-center justify-center rounded-full bg-primary/20 text-primary">
          <svg className="h-5 w-5" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
            <path strokeLinecap="round" strokeLinejoin="round" d="M5 13l4 4L19 7" />
          </svg>
        </div>
        <div className="min-w-0 flex-1">
          <p className="text-sm font-medium text-white">Bem-vindo à Unithery!</p>
          <p className="mt-0.5 text-xs text-slate-300">
            Seus 14 dias grátis começaram. Todas as funcionalidades estão liberadas.
          </p>
        </div>
        <button
          type="button"
          onClick={onDismiss}
          className="shrink-0 text-slate-400 hover:text-white"
          aria-label="Fechar"
        >
          ×
        </button>
      </div>
    </div>
  );
}
