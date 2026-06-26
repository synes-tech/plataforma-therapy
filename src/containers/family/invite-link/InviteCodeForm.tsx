import { useState, type FormEvent } from 'react';
import { callFunction } from '@shared/lib/api';
import { InviteCodeField } from './InviteCodeField';
import { InvitePatientSafetyCheck } from './InvitePatientSafetyCheck';
import { useInviteCodePreview } from './useInviteCodePreview';

interface InviteResult {
  family_member_id: string;
  patient_id: string;
  clinic_id: string;
  relationship: string;
  message: string;
}

const inputClass =
  'h-11 w-full rounded-xl border border-slate-200 bg-white px-3.5 font-mono text-base tracking-[0.25em] text-charcoal placeholder:text-charcoal-muted/40 focus:border-primary/50 focus:outline-none focus:ring-[3px] focus:ring-primary/10 sm:h-12 sm:px-4 sm:text-lg sm:tracking-[0.3em]';

/**
 * Formulário de vínculo por código (usuário já autenticado).
 * Pré-visualiza o paciente antes de habilitar confirmação.
 */
export function InviteCodeForm() {
  const [code, setCode] = useState('');
  const [name, setName] = useState('');
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [success, setSuccess] = useState(false);

  const preview = useInviteCodePreview(code);
  const canSubmit = preview.isVerified && name.trim().length >= 2 && !isSubmitting;

  async function handleSubmit(e: FormEvent) {
    e.preventDefault();
    if (!canSubmit) return;

    setError(null);
    setIsSubmitting(true);

    try {
      await callFunction<InviteResult>('validate-invite', {
        code: preview.normalizedCode,
        name: name.trim(),
      });
      setSuccess(true);
      setTimeout(() => window.location.reload(), 1500);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Erro ao validar convite');
    } finally {
      setIsSubmitting(false);
    }
  }

  if (success) {
    return (
      <div className="rounded-2xl border border-mint/20 bg-mint/10 p-6 text-center">
        <div className="mx-auto mb-3 flex h-10 w-10 items-center justify-center rounded-full bg-mint/20">
          <svg className="h-5 w-5 text-mint-dark" fill="none" viewBox="0 0 24 24" stroke="currentColor">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M5 13l4 4L19 7" />
          </svg>
        </div>
        <p className="text-sm font-medium text-charcoal">Vinculação realizada!</p>
        <p className="mt-1 text-xs text-charcoal-muted">Recarregando...</p>
      </div>
    );
  }

  return (
    <div className="rounded-2xl border border-slate-200/80 bg-white p-5 shadow-card sm:p-6">
      <h3 className="font-display text-lg font-semibold text-charcoal">Código de Convite</h3>
      <p className="mt-1 text-sm text-charcoal-muted">
        Insira o código que o terapeuta forneceu para vincular-se ao paciente.
      </p>

      {error && (
        <div role="alert" className="mt-4 rounded-xl border border-error/15 bg-error-light/40 px-3 py-2.5 text-sm text-error">
          {error}
        </div>
      )}

      <form onSubmit={handleSubmit} className="mt-4 space-y-4">
        <div>
          <label htmlFor="invite-name" className="mb-1 block text-sm font-medium text-charcoal">
            Seu nome
          </label>
          <input
            id="invite-name"
            type="text"
            value={name}
            onChange={(e) => setName(e.target.value)}
            required
            placeholder="Maria Silva"
            className="h-11 w-full rounded-xl border border-slate-200 bg-white px-3.5 text-sm text-charcoal placeholder:text-charcoal-muted/40 focus:border-primary/50 focus:outline-none focus:ring-[3px] focus:ring-primary/10 sm:h-12 sm:px-4"
          />
        </div>

        <InviteCodeField
          id="invite-code"
          label="Código (8 caracteres)"
          value={code}
          onChange={setCode}
          inputClassName={inputClass}
        />

        <InvitePatientSafetyCheck
          status={preview.status}
          patientName={preview.patientName}
          error={preview.error}
        />

        <button
          type="submit"
          disabled={!canSubmit}
          className="h-11 w-full rounded-xl bg-charcoal text-sm font-medium text-white transition-all hover:bg-charcoal-light active:scale-[0.98] disabled:cursor-not-allowed disabled:opacity-50 sm:h-12"
        >
          {isSubmitting ? 'Validando...' : 'Vincular'}
        </button>
      </form>
    </div>
  );
}
