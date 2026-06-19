interface SettingsPlanBannerProps {
  planName: string;
  onManage: () => void;
}

/** Mesmas medidas dos links em SettingsHubTabs — uma linha, mesma altura. */
const TAB_MATCH =
  'inline-flex h-full shrink-0 items-center gap-1.5 whitespace-nowrap rounded-lg px-3 py-2 text-xs font-medium sm:gap-2 sm:px-4 sm:py-2.5 sm:text-sm';

export function SettingsPlanBanner({ planName, onManage }: SettingsPlanBannerProps) {
  return (
    <div className="flex shrink-0 items-stretch rounded-xl p-1">
      <button
        type="button"
        onClick={onManage}
        aria-label={`Plano atual: ${planName}. Gerenciar plano`}
        className={`${TAB_MATCH} border border-mint/40 bg-gradient-to-b from-mint-50 to-emerald-50/90 text-charcoal shadow-sm transition-all hover:border-mint/55 hover:from-mint-100 hover:to-emerald-50 active:scale-[0.98]`}
      >
        <span className="text-[9px] font-semibold uppercase tracking-wide text-mint-dark/90 sm:text-[10px]">
          Plano atual
        </span>
        <span className="text-charcoal-muted/40" aria-hidden>
          ·
        </span>
        <span className="max-w-[4.5rem] truncate font-semibold text-charcoal sm:max-w-[6rem]" title={planName}>
          {planName}
        </span>
        <span className="text-charcoal-muted/40" aria-hidden>
          ·
        </span>
        <span className="font-semibold text-mint-dark">Gerenciar</span>
      </button>
    </div>
  );
}
