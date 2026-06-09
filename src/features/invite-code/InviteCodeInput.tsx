import { useState, type FormEvent } from 'react';
import { callFunction } from '@shared/lib/api';

interface InviteResult {
  family_member_id: string;
  patient_id: string;
  clinic_id: string;
  relationship: string;
  message: string;
}

export function InviteCodeInput() {
  const [code, setCode] = useState('');
  const [name, setName] = useState('');
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [success, setSuccess] = useState(false);

  async function handleSubmit(e: FormEvent) {
    e.preventDefault();
    setError(null);
    setIsSubmitting(true);

    try {
      await callFunction<InviteResult>('validate-invite', { code, name });
      setSuccess(true);
      // Reload to get updated JWT with family role + clinic_id
      setTimeout(() => window.location.reload(), 1500);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Erro ao validar convite');
    } finally {
      setIsSubmitting(false);
    }
  }

  if (success) {
    return (
      <div className="glass-card p-6 text-center">
        <div className="mx-auto mb-3 flex h-10 w-10 items-center justify-center rounded-full bg-success/20">
          <svg className="h-5 w-5 text-success" fill="none" viewBox="0 0 24 24" stroke="currentColor">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M5 13l4 4L19 7" />
          </svg>
        </div>
        <p className="text-sm font-medium text-text">Vinculação realizada!</p>
        <p className="mt-1 text-xs text-text-muted">Recarregando...</p>
      </div>
    );
  }

  return (
    <div className="glass-card p-6">
      <h3 className="text-lg font-medium text-text">Código de Convite</h3>
      <p className="mt-1 text-sm text-text-muted">
        Insira o código que o terapeuta forneceu para vincular-se ao paciente.
      </p>

      {error && (
        <div role="alert" className="mt-4 rounded-lg border border-error/20 bg-error/10 px-3 py-2 text-sm text-error">
          {error}
        </div>
      )}

      <form onSubmit={handleSubmit} className="mt-4 space-y-4">
        <div>
          <label htmlFor="invite-name" className="mb-1 block text-sm text-text-muted">
            Seu nome
          </label>
          <input
            id="invite-name"
            type="text"
            value={name}
            onChange={(e) => setName(e.target.value)}
            required
            placeholder="Maria Silva"
            className="w-full rounded-lg border border-surface-border bg-surface-light px-4 py-2.5 text-text placeholder:text-text-muted/50 focus:border-primary focus:outline-none focus:ring-1 focus:ring-primary"
          />
        </div>

        <div>
          <label htmlFor="invite-code" className="mb-1 block text-sm text-text-muted">
            Código (8 caracteres)
          </label>
          <input
            id="invite-code"
            type="text"
            value={code}
            onChange={(e) => setCode(e.target.value.slice(0, 8))}
            required
            maxLength={8}
            placeholder="AbC12xYz"
            className="w-full rounded-lg border border-surface-border bg-surface-light px-4 py-2.5 font-mono text-lg tracking-widest text-text placeholder:text-text-muted/50 focus:border-primary focus:outline-none focus:ring-1 focus:ring-primary"
          />
        </div>

        <button
          type="submit"
          disabled={isSubmitting || code.length !== 8 || !name}
          className="w-full rounded-lg bg-primary px-4 py-2.5 text-sm font-medium text-white transition-colors hover:bg-primary-dark disabled:cursor-not-allowed disabled:opacity-50"
        >
          {isSubmitting ? 'Validando...' : 'Vincular'}
        </button>
      </form>
    </div>
  );
}
