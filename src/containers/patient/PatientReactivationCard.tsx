import { LoadingButton } from '@containers/loading';
import { formatBirthDateBr } from './patient-cpf.utils';
import type { VerifyPatientCpfMatch } from './patient-cpf.types';
import { getReactivationCooldownStatus } from './patient-reactivation-cooldown.utils';
import { PatientReactivationCooldownBadge } from './PatientReactivationCooldownBadge';

interface PatientReactivationCardProps {
  match: VerifyPatientCpfMatch;
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
      <LoadingButton
        type="button"
        onClick={onReactivate}
        loading={isReactivating}
        disabled={!cooldown.canReactivate}
        fullWidth
        className={`mt-4 min-h-12 font-semibold ${
          cooldown.canReactivate ? '' : 'cursor-not-allowed bg-slate-200 text-gray-500 opacity-50'
        }`}
      >
        Reativar Vínculo
      </LoadingButton>
    </div>
  );
}

interface PatientAlreadyActiveCardProps {
  match: VerifyPatientCpfMatch;
  onViewRecord: () => void;
  onRegisterAnother?: () => void;
}

export function PatientAlreadyActiveCard({
  match,
  onViewRecord,
  onRegisterAnother,
}: PatientAlreadyActiveCardProps) {
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
      {onRegisterAnother && (
        <button
          type="button"
          onClick={onRegisterAnother}
          className="mt-2 inline-flex min-h-11 w-full items-center justify-center rounded-xl border border-slate-200 bg-white px-5 text-sm font-medium text-charcoal transition-colors hover:bg-slate-50"
        >
          Cadastrar outro dependente com este CPF
        </button>
      )}
    </div>
  );
}
