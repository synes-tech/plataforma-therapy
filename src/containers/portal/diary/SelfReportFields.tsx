import {
  anxietyScaleLabel,
  moodScaleLabel,
  type SelfDiaryDraft,
} from '@shared/lib/portal-diary';

/**
 * Campos do auto-relato.
 *
 * A escala vai a 10, e não a 5 como no modo cuidador, porque quem vive o quadro percebe
 * variações que um observador externo não distingue. Um cuidador consegue dizer "foi um dia
 * bom ou ruim"; a própria pessoa sabe a diferença entre um 6 e um 7 — e é nessa diferença
 * que o terapeuta enxerga tendência antes da crise.
 */

interface SelfReportFieldsProps {
  value: SelfDiaryDraft;
  onChange: (patch: Partial<SelfDiaryDraft>) => void;
  disabled?: boolean;
}

const CARD = 'rounded-2xl border border-slate-200/80 bg-white p-4 shadow-soft';

function ScaleSlider({
  id,
  title,
  value,
  onChange,
  readout,
  lowLabel,
  highLabel,
  accent,
  disabled,
}: {
  id: string;
  title: string;
  value: number;
  onChange: (next: number) => void;
  readout: string;
  lowLabel: string;
  highLabel: string;
  accent: string;
  disabled?: boolean;
}) {
  return (
    <section className={CARD}>
      <div className="mb-3 flex items-baseline justify-between gap-3">
        <h4 className="text-sm font-medium text-charcoal">
          <label htmlFor={id}>{title}</label>
        </h4>
        <p className="text-xs font-medium text-primary">
          {value}/10 · {readout}
        </p>
      </div>
      <input
        id={id}
        type="range"
        min={1}
        max={10}
        step={1}
        value={value}
        disabled={disabled}
        onChange={(e) => onChange(Number(e.target.value))}
        className={`w-full ${accent}`}
        aria-valuetext={`${value} de 10, ${readout}`}
      />
      <div className="mt-1 flex justify-between text-[10px] text-charcoal-muted/70">
        <span>{lowLabel}</span>
        <span>{highLabel}</span>
      </div>
    </section>
  );
}

export function SelfReportFields({ value, onChange, disabled }: SelfReportFieldsProps) {
  return (
    <>
      <ScaleSlider
        id="humor-hoje"
        title="Como está seu humor?"
        value={value.mood10}
        onChange={(mood10) => onChange({ mood10 })}
        readout={moodScaleLabel(value.mood10)}
        lowLabel="Muito difícil"
        highLabel="Muito bom"
        accent="accent-primary"
        disabled={disabled}
      />

      <ScaleSlider
        id="ansiedade-hoje"
        title="E sua ansiedade?"
        value={value.anxiety10}
        onChange={(anxiety10) => onChange({ anxiety10 })}
        readout={anxietyScaleLabel(value.anxiety10)}
        lowLabel="Tranquilo"
        highLabel="Muito alta"
        accent="accent-alert"
        disabled={disabled}
      />

      <section className={`${CARD} lg:col-span-2 xl:col-span-3`}>
        <h4 className="mb-1 text-sm font-medium text-charcoal">
          <label htmlFor="gatilhos-hoje">Algum gatilho hoje?</label>
        </h4>
        <p className="mb-2 text-xs text-charcoal-muted">
          Situações, pessoas ou pensamentos que mexeram com você. Não precisa ser nada grande.
        </p>
        <textarea
          id="gatilhos-hoje"
          value={value.triggers}
          onChange={(e) => onChange({ triggers: e.target.value })}
          maxLength={1000}
          rows={2}
          disabled={disabled}
          placeholder="Ex.: reunião de manhã, discussão em casa, notícia que li..."
          className="w-full rounded-xl border border-slate-200 bg-slate-50/50 px-3 py-2 text-sm text-charcoal placeholder:text-charcoal-muted/40 focus:border-primary/50 focus:bg-white focus:outline-none focus:ring-[3px] focus:ring-primary/10"
        />
      </section>
    </>
  );
}
