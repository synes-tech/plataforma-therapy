import { formatBirthDateBr } from './patient-cpf.utils';
import type { VerifyPatientCpfFound } from './patient-cpf.types';
import { getReactivationCooldownStatus } from './patient-reactivation-cooldown.utils';
import { PatientReactivationCooldownBadge } from './PatientReactivationCooldownBadge';

interface PatientReactivationCardProps {
  match: VerifyPatientCpfFound;
  onReactivate: () => void;
  isReactivating?: boolean;
}

export function PatientReactivationCard({
  match,
  onReactivate,
  isReactivating = false,
}: PatientReactivationCardProps) {
  const birthLabel = formatBirthDateBr(match.birth_date);
  const cooldown = getReactivationCooldownStatus(match.data_desvinculacao ?? null);

  return (
    <div className="rounded-xl border border-primary-100 bg-primary-50 p-4 sm:p-5">
      <div className="flex items-start gap-3">
        <div
          className="flex h-10 w-10 shrink-0 items-center justify-center rounded-xl bg-white text-lg shadow-sm"
          aria-hidden
        >
          📋
        </div>
        <div className="min-w-0 flex-1">
          <p className="text-xs font-semibold uppercase tracking-wider text-primary-dark">
            Paciente encontrado no seu histórico de backup
          </p>
          <p className="mt-1 font-display text-lg font-semibold text-charcoal">{match.name_masked}</p>
          {birthLabel && (
            <p className="mt-0.5 text-sm text-charcoal-muted">Nascimento: {birthLabel}</p>
          )}
          <p className="mt-2 text-sm leading-relaxed text-charcoal-muted">
            O prontuário completo será restaurado na sua carteira ativa sem criar duplicidade.
          </p>
          <div className="mt-3">
            <PatientReactivationCooldownBadge status={cooldown} />
          </div>
        </div>
      </div>
      <button
        type="button"
        onClick={onReactivate}
        disabled={isReactivating || !cooldown.canReactivate}
        className={`mt-4 inline-flex min-h-12 w-full items-center justify-center rounded-xl px-5 text-sm font-semibold shadow-sm transition-colors ${
          cooldown.canReactivate
            ? 'bg-primary text-white hover:bg-primary-dark'
            : 'cursor-not-allowed bg-slate-200 text-gray-500 opacity-50'
        } disabled:opacity-50`}
      >
        {isReactivating ? 'Reativando...' : 'Reativar Vínculo'}
      </button>
    </div>
  );
}

interface PatientAlreadyActiveCardProps {
  match: VerifyPatientCpfFound;
  onViewRecord: () => void;
}

export function PatientAlreadyActiveCard({ match, onViewRecord }: PatientAlreadyActiveCardProps) {
  const birthLabel = formatBirthDateBr(match.birth_date);

  return (
    <div className="rounded-xl border border-mint/30 bg-mint-50 p-4 sm:p-5">
      <p className="text-xs font-semibold uppercase tracking-wider text-mint-dark">
        Paciente já ativo na carteira
      </p>
      <p className="mt-1 font-display text-lg font-semibold text-charcoal">{match.name_masked}</p>
      {birthLabel && <p className="mt-0.5 text-sm text-charcoal-muted">Nascimento: {birthLabel}</p>}
      <p className="mt-2 text-sm text-charcoal-muted">
        Este CPF já está vinculado. Abra o prontuário em vez de criar um novo cadastro.
      </p>
      <button
        type="button"
        onClick={onViewRecord}
        className="mt-4 inline-flex min-h-11 w-full items-center justify-center rounded-xl border border-mint/40 bg-white px-5 text-sm font-medium text-mint-dark transition-colors hover:bg-mint-50"
      >
        Ver prontuário
      </button>
    </div>
  );
}
