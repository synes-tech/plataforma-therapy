interface RegisterProgressBarProps {
  currentStep: 1 | 2;
}

export function RegisterProgressBar({ currentStep }: RegisterProgressBarProps) {
  return (
    <div className="w-full px-6 md:hidden" aria-label={`Etapa ${currentStep} de 2`}>
      <div className="flex gap-2">
        <div
          className={`h-1 flex-1 rounded-full transition-colors duration-300 ${
            currentStep >= 1 ? 'bg-primary' : 'bg-slate-200'
          }`}
        />
        <div
          className={`h-1 flex-1 rounded-full transition-colors duration-300 ${
            currentStep >= 2 ? 'bg-primary' : 'bg-slate-200'
          }`}
        />
      </div>
      <p className="mt-2 text-center text-[11px] text-charcoal-muted">
        Etapa {currentStep} de 2
      </p>
    </div>
  );
}
