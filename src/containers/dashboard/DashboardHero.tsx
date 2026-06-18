import { Link } from 'react-router-dom';
import { getFirstName, getGreetingEmoji, getTimeGreeting } from '@shared/lib/greeting';
import { briefingSubtitle } from './dashboard.utils';

function PlusIcon() {
  return (
    <svg className="h-4 w-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2.2} aria-hidden>
      <path strokeLinecap="round" strokeLinejoin="round" d="M12 4.5v15m7.5-7.5h-15" />
    </svg>
  );
}

interface DashboardHeroProps {
  professionalName: string;
  summary?: Parameters<typeof briefingSubtitle>[0];
}

export function DashboardHero({ professionalName, summary }: DashboardHeroProps) {
  const greeting = getTimeGreeting();
  const emoji = getGreetingEmoji();
  const firstName = getFirstName(professionalName || 'Terapeuta');

  return (
    <header className="mb-6 md:mb-8">
      <div className="flex flex-col gap-4 md:flex-row md:items-start md:justify-between">
        <div>
          <h1 className="text-3xl font-semibold tracking-tight text-charcoal">
            <span className="mr-2" aria-hidden>
              {emoji}
            </span>
            {greeting}, {firstName}.
          </h1>
          <p className="mt-2 text-sm text-charcoal-muted">{briefingSubtitle(summary)}</p>
        </div>

        <Link
          to="/patients"
          className="hidden min-h-11 shrink-0 items-center justify-center gap-2 rounded-lg bg-primary px-5 text-sm font-medium text-white shadow-sm transition-colors hover:bg-primary-dark active:scale-[0.98] md:inline-flex"
        >
          <PlusIcon />
          Novo Paciente
        </Link>
      </div>

      <Link
        to="/patients"
        className="mt-4 flex min-h-12 w-full items-center justify-center gap-2 rounded-lg bg-primary text-sm font-medium text-white shadow-sm transition-colors hover:bg-primary-dark active:scale-[0.98] md:hidden"
      >
        <PlusIcon />
        Novo Paciente
      </Link>
    </header>
  );
}
