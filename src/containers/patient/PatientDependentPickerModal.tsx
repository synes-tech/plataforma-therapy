import { StandardModal } from '@shared/ui/StandardModal';
import { formatBirthDateBr } from './patient-cpf.utils';
import type { VerifyPatientCpfMatch } from './patient-cpf.types';

interface PatientDependentPickerModalProps {
  isOpen: boolean;
  onClose: () => void;
  matches: VerifyPatientCpfMatch[];
  onSelect: (match: VerifyPatientCpfMatch) => void;
  onRegisterNew?: () => void;
}

function statusLabel(status: VerifyPatientCpfMatch['status_vinculo']): string {
  return status === 'desvinculado' ? 'Arquivado (backup)' : 'Ativo na carteira';
}

export function PatientDependentPickerModal({
  isOpen,
  onClose,
  matches,
  onSelect,
  onRegisterNew,
}: PatientDependentPickerModalProps) {
  return (
    <StandardModal
      isOpen={isOpen}
      onClose={onClose}
      title="Selecionar dependente"
      size="md"
      footer={
        <>
          {onRegisterNew && (
            <button
              type="button"
              onClick={onRegisterNew}
              className="inline-flex h-11 w-full items-center justify-center rounded-xl border border-primary/30 bg-primary-50 px-5 text-sm font-medium text-primary-dark transition-colors hover:bg-primary-50/80 md:w-auto"
            >
              Cadastrar novo dependente
            </button>
          )}
          <button
            type="button"
            onClick={onClose}
            className="inline-flex h-11 w-full items-center justify-center rounded-xl border border-slate-200 px-5 text-sm font-medium text-charcoal-muted transition-colors hover:bg-slate-100 md:w-auto"
          >
            Voltar
          </button>
        </>
      }
    >
      <p className="mb-4 text-sm text-charcoal-muted">
        Encontramos os seguintes dependentes atrelados a este CPF. Qual você deseja acessar ou reativar?
      </p>
      <ul className="space-y-2">
        {matches.map((match) => {
          const birthLabel = formatBirthDateBr(match.birth_date);
          return (
            <li key={match.patient_id}>
              <button
                type="button"
                onClick={() => onSelect(match)}
                className="flex w-full flex-col items-start rounded-xl border border-slate-100 bg-white px-4 py-3 text-left shadow-sm transition-colors hover:border-primary/30 hover:bg-primary-50/40"
              >
                <span className="font-display text-base font-semibold text-charcoal">
                  {match.name_masked}
                </span>
                {birthLabel && (
                  <span className="mt-0.5 text-xs text-charcoal-muted">Nascimento: {birthLabel}</span>
                )}
                <span className="mt-1 text-xs font-medium text-primary-dark">
                  {statusLabel(match.status_vinculo)}
                </span>
              </button>
            </li>
          );
        })}
      </ul>
    </StandardModal>
  );
}
