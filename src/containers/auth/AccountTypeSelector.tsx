import { BRAND_LOGO_SRC } from '@shared/lib/brand-assets';
import {
  type AccountType,
  ACCOUNT_TYPE_DESCRIPTIONS,
  ACCOUNT_TYPE_LABELS,
} from '@features/register/account-type';

interface AccountTypeSelectorProps {
  onSelect: (type: AccountType) => void;
}

export function AccountTypeSelector({ onSelect }: AccountTypeSelectorProps) {
  return (
    <div className="fixed inset-0 flex flex-col overflow-hidden">
      <div className="absolute inset-0">
        <div className="h-1/2 bg-white" />
        <div
          className="h-1/2"
          style={{
            background:
              'linear-gradient(145deg, #FDF8F4 0%, #F5EDE8 30%, #EDE4DC 60%, #F8F0EB 100%)',
          }}
        />
      </div>

      <section className="relative z-10 flex flex-1 flex-col items-center justify-center px-5 md:px-8">
        <img src={BRAND_LOGO_SRC} alt="Unithery" className="mb-4 h-10 w-auto" />
        <h1 className="text-center font-serif text-2xl font-medium tracking-tight text-charcoal">
          Como você vai usar o Unithery?
        </h1>
        <p className="mt-2 max-w-md text-center text-sm text-charcoal-muted">
          Escolha o perfil que melhor descreve sua prática. Isso define planos e campos de cadastro.
        </p>

        <div className="mt-10 grid w-full max-w-2xl gap-4 md:grid-cols-2">
          {(['corporate', 'solo'] as AccountType[]).map((type) => (
            <button
              key={type}
              type="button"
              onClick={() => onSelect(type)}
              className="group flex min-h-[140px] flex-col rounded-2xl border border-slate-200/80 bg-white/90 p-5 text-left shadow-soft backdrop-blur-sm transition-all hover:border-primary/40 hover:shadow-card active:scale-[0.99]"
            >
              <span className="font-display text-base font-bold text-charcoal group-hover:text-primary-dark">
                {ACCOUNT_TYPE_LABELS[type]}
              </span>
              <span className="mt-2 flex-1 text-xs leading-relaxed text-charcoal-muted">
                {ACCOUNT_TYPE_DESCRIPTIONS[type]}
              </span>
              <span className="mt-4 text-xs font-medium text-primary">Continuar →</span>
            </button>
          ))}
        </div>

        <p className="mt-10 text-sm text-charcoal-muted">
          Já possui conta?{' '}
          <a
            href="/login"
            className="font-medium text-charcoal underline decoration-charcoal/30 underline-offset-4 hover:text-primary"
          >
            Fazer login
          </a>
        </p>
      </section>
    </div>
  );
}
