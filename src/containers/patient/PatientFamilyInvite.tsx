import { useState } from 'react';
import { LoadingButton } from '@containers/loading';
import { callFunction } from '@shared/lib/api';
import { StandardModal } from '@shared/ui/StandardModal';

export function usePatientFamilyInvite(patientId: string) {
  const [open, setOpen] = useState(false);
  const [code, setCode] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);
  const [copied, setCopied] = useState(false);
  const [error, setError] = useState<string | null>(null);

  async function generate() {
    setLoading(true);
    setError(null);
    try {
      const result = await callFunction<{ code: string; expires_at: string }>('generate-invite', {
        patient_id: patientId,
        relationship: 'responsável',
        expires_in_hours: 72,
      });
      setCode(result.code);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Não foi possível gerar o convite');
    } finally {
      setLoading(false);
    }
  }

  function copy() {
    if (code) {
      navigator.clipboard.writeText(code);
      setCopied(true);
      setTimeout(() => setCopied(false), 2000);
    }
  }

  function close() {
    setOpen(false);
  }

  return { open, setOpen, close, code, loading, copied, error, generate, copy };
}

export type PatientFamilyInviteState = ReturnType<typeof usePatientFamilyInvite>;

export function PatientFamilyInviteButton({ onClick }: { onClick: () => void }) {
  return (
    <button
      type="button"
      onClick={onClick}
      title="Gerar acesso para a família"
      aria-label="Gerar acesso família"
      className="inline-flex shrink-0 items-center gap-2 rounded-xl border border-slate-200 bg-slate-50 px-3 py-2 text-sm font-medium text-charcoal-muted transition-colors hover:border-slate-300 hover:bg-slate-100 hover:text-charcoal"
    >
      <svg className="h-4 w-4 shrink-0" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2} aria-hidden>
        <path strokeLinecap="round" strokeLinejoin="round" d="M16 7a4 4 0 11-8 0 4 4 0 018 0zM12 14a7 7 0 00-7 7h10m4-7v6m3-3h-6" />
      </svg>
      <span className="whitespace-nowrap">Gerar acesso família</span>
    </button>
  );
}

function InviteCodeContent({
  invite,
}: {
  invite: Pick<PatientFamilyInviteState, 'code' | 'loading' | 'copied' | 'error' | 'generate' | 'copy'>;
}) {
  if (invite.error) {
    return (
      <p className="rounded-xl border border-error/10 bg-error-light/40 px-4 py-3 text-sm text-error" role="alert">
        {invite.error}
      </p>
    );
  }

  if (invite.code) {
    return (
      <div className="space-y-4">
        <div className="rounded-xl border border-slate-100 bg-slate-50 px-4 py-4">
          <p className="text-xs font-medium uppercase tracking-wider text-charcoal-muted">
            Código de convite (válido por 72h)
          </p>
          <code className="mt-2 block font-mono text-2xl font-semibold tracking-[0.2em] text-primary">
            {invite.code}
          </code>
        </div>
        <p className="text-sm text-charcoal-muted">
          Envie este código para a família. Eles podem usá-lo no cadastro ou em{' '}
          <span className="font-medium text-charcoal">Inserir convite</span> após o login.
        </p>
        <button
          type="button"
          onClick={invite.copy}
          className="inline-flex h-11 w-full items-center justify-center gap-2 rounded-xl border border-slate-200 bg-white text-sm font-medium text-charcoal transition-colors hover:border-primary/40 hover:text-primary sm:w-auto sm:px-5"
        >
          {invite.copied ? (
            <>
              <svg className="h-4 w-4 text-emerald-600" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                <path strokeLinecap="round" strokeLinejoin="round" d="M5 13l4 4L19 7" />
              </svg>
              Código copiado
            </>
          ) : (
            'Copiar código'
          )}
        </button>
      </div>
    );
  }

  return (
    <div className="space-y-4">
      <p className="text-sm leading-relaxed text-charcoal-muted">
        O responsável usará o código para criar a conta familiar e acessar o diário de rotina e os combinados
        deste paciente.
      </p>
      <LoadingButton
        type="button"
        onClick={invite.generate}
        loading={invite.loading}
        loadingLabel="Gerando convite..."
        fullWidth
        className="h-11"
      >
        Gerar código de convite
      </LoadingButton>
    </div>
  );
}

export function PatientFamilyInviteModal({
  isOpen,
  onClose,
  patientName,
  invite,
}: {
  isOpen: boolean;
  onClose: () => void;
  patientName: string;
  invite: Pick<PatientFamilyInviteState, 'code' | 'loading' | 'copied' | 'error' | 'generate' | 'copy'>;
}) {
  return (
    <StandardModal
      isOpen={isOpen}
      onClose={onClose}
      title="Acesso familiar"
      size="md"
      footer={
        <button
          type="button"
          onClick={onClose}
          className="inline-flex h-11 w-full items-center justify-center rounded-xl border border-slate-200 px-5 text-sm font-medium text-charcoal transition-colors hover:bg-slate-50 md:w-auto"
        >
          Fechar
        </button>
      }
    >
      <p className="mb-5 text-sm text-charcoal-muted">
        Convite para a família de <span className="font-medium text-charcoal">{patientName}</span>
      </p>
      <InviteCodeContent invite={invite} />
    </StandardModal>
  );
}
