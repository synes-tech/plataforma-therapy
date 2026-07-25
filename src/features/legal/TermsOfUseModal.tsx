import { StandardModal } from '@shared/ui/StandardModal';
import {
  TERMS_ACCEPTANCE_NOTICE,
  TERMS_PARTIES,
  TERMS_PARTS,
  TERMS_TITLE,
} from './terms-of-use-content';

interface TermsOfUseModalProps {
  isOpen: boolean;
  onClose: () => void;
  /** Ação do botão primário do footer (aceitar). */
  onAccept: () => void;
  /** Rótulo do botão primário. Ex.: "Aceitar e criar minha conta". */
  acceptLabel: string;
}

/**
 * TermsOfUseModal — Contrato de Adesão e Termo de Uso Integrado.
 * Usado na landing (footer) e no registro (aceite obrigatório).
 */
export function TermsOfUseModal({ isOpen, onClose, onAccept, acceptLabel }: TermsOfUseModalProps) {
  return (
    <StandardModal
      isOpen={isOpen}
      onClose={onClose}
      title={TERMS_TITLE}
      size="2xl"
      footer={
        <>
          <button
            type="button"
            onClick={onClose}
            className="h-11 rounded-xl border border-slate-200 bg-white px-5 text-sm font-medium text-charcoal transition-colors hover:border-charcoal/20 md:h-10"
          >
            Fechar
          </button>
          <button
            type="button"
            onClick={onAccept}
            className="h-11 rounded-xl bg-primary px-5 text-sm font-semibold text-white shadow-sm transition-all hover:bg-primary-dark active:scale-[0.98] md:h-10"
          >
            {acceptLabel}
          </button>
        </>
      }
    >
      <div className="space-y-8 text-sm leading-relaxed text-charcoal-muted">
        {/* Preâmbulo */}
        <div className="space-y-3">
          <p className="rounded-xl border border-slate-100 bg-slate-50 px-4 py-3 text-[13px]">
            {TERMS_PARTIES}
          </p>
          <div className="rounded-xl border border-primary/15 bg-primary-50/60 px-4 py-3">
            <p className="text-[13px] text-charcoal">
              <span className="font-semibold">Aceite eletrônico indispensável.</span>{' '}
              {TERMS_ACCEPTANCE_NOTICE.replace(/^Aceite eletrônico indispensável: /, '')}
            </p>
          </div>
        </div>

        {TERMS_PARTS.map((part) => (
          <section key={part.id} aria-labelledby={part.id}>
            <p className="text-[11px] font-semibold uppercase tracking-[0.18em] text-primary">
              {part.label}
            </p>
            <h3
              id={part.id}
              className="mt-1 font-serif text-lg font-medium tracking-tight text-charcoal"
            >
              {part.title}
            </h3>

            <div className="mt-4 space-y-5">
              {part.clauses.map((clause) => (
                <article
                  key={clause.id}
                  className="rounded-2xl border border-slate-100 bg-white p-5 shadow-soft"
                >
                  <h4 className="font-display text-sm font-semibold text-charcoal">
                    {clause.title}
                  </h4>
                  {clause.intro && <p className="mt-2 text-[13px]">{clause.intro}</p>}
                  <ol className="mt-3 space-y-3">
                    {clause.items.map((item, index) => (
                      <li key={index} className="flex gap-3">
                        <span className="mt-0.5 flex h-5 w-5 shrink-0 items-center justify-center rounded-full bg-primary-50 text-[11px] font-semibold text-primary-dark">
                          {index + 1}
                        </span>
                        <p className="text-[13px]">
                          {item.lead && (
                            <span className="font-semibold text-charcoal">{item.lead}: </span>
                          )}
                          {item.text}
                        </p>
                      </li>
                    ))}
                  </ol>
                </article>
              ))}
            </div>
          </section>
        ))}

        <p className="border-t border-slate-100 pt-4 text-center text-xs text-charcoal-muted/60">
          Unithery © 2026 — Inteligência Artificial Aplicada ao Desenvolvimento Humano. Em
          conformidade com a LGPD.
        </p>
      </div>
    </StandardModal>
  );
}
