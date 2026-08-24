import {
  PATIENT_PROFILE_TYPES,
  calculateAge,
  type PatientProfileType,
} from '@shared/lib/clinical-profile';

/**
 * Cartões de perfil clínico.
 *
 * Deliberadamente **não** são um seletor. O perfil é determinado pela data de nascimento —
 * é um fato, não uma preferência do terapeuta. O backend rejeita perfil que não confere com
 * a data, então um seletor livre só produziria erro de validação depois de seis passos
 * preenchidos. O que os cartões fazem é tornar visível e imediata a consequência da data
 * digitada: o terapeuta vê, ali mesmo, que o formulário adiante vai mudar.
 */

const PROFILE_COPY: Record<
  PatientProfileType,
  { title: string; range: string; consequence: string }
> = {
  CHILD: {
    title: 'Criança',
    range: 'até 12 anos',
    consequence: 'Portal do responsável, dinâmica familiar e hiperfocos',
  },
  ADOLESCENT: {
    title: 'Adolescente',
    range: '13 a 17 anos',
    consequence: 'Portal do responsável, com gatilhos e interesses',
  },
  ADULT: {
    title: 'Adulto',
    range: '18 anos ou mais',
    consequence: 'Acesso próprio ao portal, rede de apoio e gatilhos',
  },
};

function ProfileIcon({ profile, className }: { profile: PatientProfileType; className: string }) {
  if (profile === 'CHILD') {
    return (
      <svg className={className} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={1.6} aria-hidden>
        <circle cx="12" cy="8" r="4" />
        <path strokeLinecap="round" d="M6 21c0-3.3 2.7-6 6-6s6 2.7 6 6" />
        <path strokeLinecap="round" d="M9.5 7.5h.01M14.5 7.5h.01" />
      </svg>
    );
  }
  if (profile === 'ADOLESCENT') {
    return (
      <svg className={className} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={1.6} aria-hidden>
        <circle cx="12" cy="7" r="3.5" />
        <path strokeLinecap="round" d="M5.5 21c0-3.6 2.9-6.5 6.5-6.5s6.5 2.9 6.5 6.5" />
        <path strokeLinecap="round" d="M16.5 3.5c1.2.6 1.8 1.8 1.6 3" />
      </svg>
    );
  }
  return (
    <svg className={className} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={1.6} aria-hidden>
      <circle cx="12" cy="7" r="3.5" />
      <path strokeLinecap="round" d="M4.5 21c0-4.1 3.4-7.5 7.5-7.5s7.5 3.4 7.5 7.5" />
    </svg>
  );
}

interface PatientProfileTypeCardsProps {
  birthDate: string;
  profile: PatientProfileType | null;
}

export function PatientProfileTypeCards({ birthDate, profile }: PatientProfileTypeCardsProps) {
  const age = birthDate ? calculateAge(birthDate) : Number.NaN;
  const hasAge = Number.isFinite(age) && age >= 0 && age < 130;

  return (
    <section aria-labelledby="perfil-clinico-titulo" className="space-y-2">
      <div className="flex flex-wrap items-baseline justify-between gap-x-3 gap-y-1">
        <h4 id="perfil-clinico-titulo" className="text-sm font-medium text-charcoal">
          Perfil clínico
        </h4>
        <p className="text-[11px] text-charcoal-muted">
          {hasAge
            ? `Definido pela data de nascimento — ${age} ${age === 1 ? 'ano' : 'anos'}`
            : 'Preencha a data de nascimento para definir'}
        </p>
      </div>

      <ul className="grid grid-cols-1 gap-2 sm:grid-cols-3" role="list">
        {PATIENT_PROFILE_TYPES.map((value) => {
          const active = profile === value;
          const copy = PROFILE_COPY[value];
          return (
            <li
              key={value}
              aria-current={active ? 'true' : undefined}
              className={`rounded-xl border px-3 py-3 transition-colors ${
                active
                  ? 'border-primary bg-primary-50 ring-1 ring-primary/25'
                  : 'border-slate-200 bg-white'
              } ${profile && !active ? 'opacity-45' : ''}`}
            >
              <div className="flex items-start gap-2.5">
                <ProfileIcon
                  profile={value}
                  className={`mt-0.5 h-5 w-5 shrink-0 ${active ? 'text-primary' : 'text-charcoal-muted'}`}
                />
                <div className="min-w-0">
                  <p className={`text-sm font-medium ${active ? 'text-primary' : 'text-charcoal'}`}>
                    {copy.title}
                  </p>
                  <p className="text-[11px] text-charcoal-muted">{copy.range}</p>
                  {active && (
                    <p className="mt-1.5 text-[11px] leading-snug text-charcoal-muted">
                      {copy.consequence}
                    </p>
                  )}
                </div>
              </div>
            </li>
          );
        })}
      </ul>
    </section>
  );
}
