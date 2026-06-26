import { useState, type FormEvent } from 'react';
import { useNavigate } from 'react-router-dom';
import { LoadingButton } from '@containers/loading';
import { InviteCodeField } from '@containers/family/invite-link/InviteCodeField';
import { InvitePatientSafetyCheck } from '@containers/family/invite-link/InvitePatientSafetyCheck';
import { useInviteCodePreview } from '@containers/family/invite-link/useInviteCodePreview';
import { supabase } from '@shared/lib/supabase';
import { useAuth } from '@shared/hooks/useAuth';
import { callFunction } from '@shared/lib/api';
import { BRAND_LOGO_SRC } from '@shared/lib/brand-assets';

const codeInputClass =
  'h-12 w-full rounded-xl border border-slate-200 bg-white px-4 font-mono text-lg tracking-[0.3em] text-charcoal placeholder:text-charcoal-muted/40 focus:border-primary/50 focus:outline-none focus:ring-[3px] focus:ring-primary/10';

/**
 * LinkInvite — vínculo de código para quem já está autenticado mas ainda
 * não associou nenhum paciente. Reusa link-family-account.
 */
export default function LinkInvite() {
  const navigate = useNavigate();
  const { user } = useAuth();
  const [name, setName] = useState('');
  const [code, setCode] = useState('');
  const [error, setError] = useState<string | null>(null);
  const [isSubmitting, setIsSubmitting] = useState(false);

  const preview = useInviteCodePreview(code);
  const canSubmit = preview.isVerified && name.trim().length >= 2 && !isSubmitting;

  async function handleSubmit(e: FormEvent) {
    e.preventDefault();
    if (!canSubmit) return;

    setError(null);
    setIsSubmitting(true);
    try {
      await callFunction('link-family-account', {
        invite_code: preview.normalizedCode,
        name: name.trim(),
      });
      await supabase.auth.refreshSession();
      navigate('/family/diary', { replace: true });
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Erro ao validar convite');
    } finally {
      setIsSubmitting(false);
    }
  }

  return (
    <div className="relative flex min-h-dvh flex-col">
      <div className="absolute inset-0 -z-10">
        <div className="h-2/5 bg-white" />
        <div
          className="h-3/5"
          style={{ background: 'linear-gradient(145deg, #FDF8F4 0%, #F5EDE8 30%, #EDE4DC 60%, #F8F0EB 100%)' }}
        />
      </div>

      <div className="mx-auto flex w-full max-w-md flex-1 flex-col justify-center px-6 py-12">
        <div className="mb-8 text-center">
          <img src={BRAND_LOGO_SRC} alt="Unithery" className="mx-auto h-14 w-auto" />
          <h1 className="mt-6 font-serif text-2xl tracking-tight text-charcoal">Vincular paciente</h1>
          <p className="mt-1.5 text-sm text-charcoal-muted">
            Insira o código de convite que o terapeuta forneceu.
          </p>
        </div>

        <div className="rounded-3xl border border-slate-200/80 bg-white p-6 shadow-card">
          {error && (
            <div role="alert" className="mb-5 rounded-xl border border-error/15 bg-error-light/40 px-4 py-3 text-sm text-error">
              {error}
            </div>
          )}

          <form onSubmit={handleSubmit} className="space-y-4">
            <div>
              <label htmlFor="link-name" className="mb-1.5 block text-sm font-medium text-charcoal">
                Seu nome
              </label>
              <input
                id="link-name"
                type="text"
                value={name}
                onChange={(e) => setName(e.target.value)}
                required
                placeholder={user?.email?.split('@')[0] ?? 'Maria Silva'}
                className="h-12 w-full rounded-xl border border-slate-200 bg-white px-4 text-sm text-charcoal placeholder:text-charcoal-muted/40 focus:border-primary/50 focus:outline-none focus:ring-[3px] focus:ring-primary/10"
              />
            </div>

            <InviteCodeField
              id="link-code"
              label="Código (8 caracteres)"
              value={code}
              onChange={setCode}
              inputClassName={codeInputClass}
            />

            <InvitePatientSafetyCheck
              status={preview.status}
              patientName={preview.patientName}
              error={preview.error}
            />

            <LoadingButton
              type="submit"
              loading={isSubmitting}
              loadingLabel="Vinculando..."
              variant="dark"
              fullWidth
              disabled={!canSubmit}
              className="mt-2 h-12"
            >
              Vincular
            </LoadingButton>
          </form>
        </div>
      </div>
    </div>
  );
}
