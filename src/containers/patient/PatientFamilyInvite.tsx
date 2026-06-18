import { useState } from 'react';
import { callFunction } from '@shared/lib/api';

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

  return { open, setOpen, code, loading, copied, error, generate, copy };
}

export type PatientFamilyInviteState = ReturnType<typeof usePatientFamilyInvite>;

export function PatientFamilyInviteButton({
  active,
  onClick,
}: {
  active: boolean;
  onClick: () => void;
}) {
  return (
    <button
      type="button"
      onClick={onClick}
      title="Gerar acesso para a família"
      aria-label="Gerar acesso família"
      aria-expanded={active}
      className={`inline-flex shrink-0 items-center gap-2 rounded-xl border border-slate-200 bg-slate-50 px-3 py-2 text-sm font-medium text-charcoal-muted transition-colors hover:border-slate-300 hover:bg-slate-100 hover:text-charcoal ${
        active ? 'border-primary/30 bg-primary-50/50 text-charcoal ring-2 ring-primary/15' : ''
      }`}
    >
      <svg className="h-4 w-4 shrink-0" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2} aria-hidden>
        <path strokeLinecap="round" strokeLinejoin="round" d="M16 7a4 4 0 11-8 0 4 4 0 018 0zM12 14a7 7 0 00-7 7h10m4-7v6m3-3h-6" />
      </svg>
      <span className="whitespace-nowrap">Gerar acesso família</span>
    </button>
  );
}

export function PatientFamilyInvitePanel({
  invite,
  className = '',
}: {
  invite: Pick<PatientFamilyInviteState, 'code' | 'loading' | 'copied' | 'error' | 'generate' | 'copy'>;
  className?: string;
}) {
  return (
    <div className={`rounded-xl border border-slate-100 bg-slate-50/70 p-3 ${className}`}>
      {invite.error && (
        <p className="mb-2 text-xs text-error" role="alert">{invite.error}</p>
      )}
      {invite.code ? (
        <div className="flex flex-col gap-3 sm:flex-row sm:items-center">
          <div className="flex-1 rounded-lg bg-white px-4 py-2.5">
            <p className="text-[10px] text-charcoal-muted">Código de convite (válido por 72h)</p>
            <code className="mt-0.5 block font-mono text-base font-semibold tracking-widest text-primary">
              {invite.code}
            </code>
          </div>
          <button
            type="button"
            onClick={invite.copy}
            className="shrink-0 rounded-lg border border-slate-200 px-3 py-2 text-xs font-medium text-charcoal-muted transition-colors hover:border-primary/40 hover:text-primary"
          >
            {invite.copied ? '✓ Copiado' : 'Copiar'}
          </button>
        </div>
      ) : (
        <button
          type="button"
          onClick={invite.generate}
          disabled={invite.loading}
          className="inline-flex items-center gap-2 rounded-lg bg-ai-50 px-4 py-2.5 text-xs font-medium text-ai transition-colors hover:bg-ai-glow disabled:opacity-50"
        >
          {invite.loading ? 'Gerando...' : 'Gerar código de convite'}
        </button>
      )}
    </div>
  );
}
