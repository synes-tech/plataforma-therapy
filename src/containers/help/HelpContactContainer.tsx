import { useEffect, useState, type FormEvent } from 'react';
import { Link } from 'react-router-dom';
import { useQuery } from '@tanstack/react-query';
import { LoadingButton } from '@containers/loading';
import { PageHeader } from '@containers/layout/PageHeader';
import { useAuth } from '@shared/hooks/useAuth';
import { callFunction, callPublicFunction } from '@shared/lib/api';
import { getFirebaseCurrentUser } from '@shared/lib/firebase';
import { BRAND_LOGO_SRC } from '@shared/lib/brand-assets';
import { AppLayout } from '@shared/ui/AppLayout';
import { FamilyLayout } from '@shared/ui/FamilyLayout';
import { getRetryAfterSeconds, isRateLimitedError } from '@shared/lib/rate-limit-message';
import { RateLimitMessage } from '@shared/ui/RateLimitMessage';
import { HELP_SUBJECTS, type HelpSubjectValue } from './help-contact.constants';

const FIELD =
  'h-12 w-full rounded-xl border border-slate-200 bg-white px-4 text-sm text-charcoal transition-all duration-200 placeholder:text-charcoal-muted/40 focus:border-primary/50 focus:outline-none focus:ring-[3px] focus:ring-primary/10 disabled:bg-slate-50 disabled:text-charcoal-muted';

function HelpSuccess() {
  return (
    <div className="flex flex-col items-center px-2 py-8 text-center sm:py-12" role="status">
      <div className="flex h-16 w-16 items-center justify-center rounded-full bg-mint/15 motion-safe:animate-scale-in">
        <svg className="h-8 w-8 text-mint-dark" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={2.2} aria-hidden>
          <path strokeLinecap="round" strokeLinejoin="round" d="M5 13l4 4L19 7" />
        </svg>
      </div>
      <h2 className="mt-5 font-serif text-2xl font-medium text-charcoal">Mensagem enviada</h2>
      <p className="mt-3 max-w-md text-sm leading-relaxed text-charcoal-muted">
        Muito obrigado por entrar em contato. Vamos analisar o seu chamado e responder em até
        {' '}
        <strong className="font-medium text-charcoal">24 horas úteis</strong>
        , podendo ser antes disso.
      </p>
    </div>
  );
}

function HelpForm({
  initialName,
  initialEmail,
}: {
  initialName: string;
  initialEmail: string;
}) {
  const lockName = Boolean(initialName);
  const lockEmail = Boolean(initialEmail);
  const [name, setName] = useState(initialName);
  const [email, setEmail] = useState(initialEmail);
  const [subject, setSubject] = useState<HelpSubjectValue | ''>('');
  const [message, setMessage] = useState('');
  const [website, setWebsite] = useState('');
  const [error, setError] = useState<string | null>(null);
  const [retryAfterSeconds, setRetryAfterSeconds] = useState<number | null>(null);
  const [sent, setSent] = useState(false);
  const [submitting, setSubmitting] = useState(false);

  useEffect(() => {
    if (initialName) setName(initialName);
  }, [initialName]);

  useEffect(() => {
    if (initialEmail) setEmail(initialEmail);
  }, [initialEmail]);

  async function handleSubmit(event: FormEvent) {
    event.preventDefault();
    setError(null);
    setRetryAfterSeconds(null);
    if (!subject) {
      setError('Selecione um assunto.');
      return;
    }
    setSubmitting(true);
    try {
      await callPublicFunction<{ sent: true }>('contact-form', {
        name: name.trim(),
        email: email.trim(),
        subject,
        message: message.trim(),
        website,
      });
      setSent(true);
    } catch (err) {
      if (isRateLimitedError(err)) {
        setRetryAfterSeconds(getRetryAfterSeconds(err));
      } else {
        setError(err instanceof Error ? err.message : 'Não foi possível enviar. Tente novamente.');
      }
    } finally {
      setSubmitting(false);
    }
  }

  if (sent) return <HelpSuccess />;

  return (
    <form onSubmit={handleSubmit} className="space-y-5" noValidate>
      <div className="grid grid-cols-1 gap-5 sm:grid-cols-2">
        <div>
          <label htmlFor="help-name" className="mb-2 block text-sm font-medium text-charcoal">
            Nome completo
          </label>
          <input
            id="help-name"
            type="text"
            autoComplete="name"
            value={name}
            onChange={(e) => setName(e.target.value)}
            required
            minLength={2}
            maxLength={120}
            readOnly={lockName}
            disabled={lockName}
            placeholder="Seu nome"
            className={FIELD}
          />
        </div>
        <div>
          <label htmlFor="help-email" className="mb-2 block text-sm font-medium text-charcoal">
            E-mail
          </label>
          <input
            id="help-email"
            type="email"
            autoComplete="email"
            value={email}
            onChange={(e) => setEmail(e.target.value)}
            required
            readOnly={lockEmail}
            disabled={lockEmail}
            placeholder="seu@email.com"
            className={FIELD}
          />
        </div>
      </div>

      <div>
        <label htmlFor="help-subject" className="mb-2 block text-sm font-medium text-charcoal">
          Assunto
        </label>
        <select
          id="help-subject"
          value={subject}
          onChange={(e) => setSubject(e.target.value as HelpSubjectValue | '')}
          required
          className={`${FIELD} appearance-none bg-[url('data:image/svg+xml;utf8,<svg xmlns=%22http://www.w3.org/2000/svg%22 width=%2212%22 height=%228%22 viewBox=%220 0 12 8%22><path fill=%22%23475569%22 d=%22M1 1l5 5 5-5%22/></svg>')] bg-[length:12px] bg-[right_1rem_center] bg-no-repeat pr-10`}
        >
          <option value="" disabled>
            Selecione o assunto
          </option>
          {HELP_SUBJECTS.map((item) => (
            <option key={item.value} value={item.value}>
              {item.label}
            </option>
          ))}
        </select>
      </div>

      <div>
        <label htmlFor="help-message" className="mb-2 block text-sm font-medium text-charcoal">
          Como podemos ajudar?
        </label>
        <textarea
          id="help-message"
          value={message}
          onChange={(e) => setMessage(e.target.value)}
          required
          minLength={10}
          maxLength={4000}
          rows={6}
          placeholder="Descreva o que você precisa — quanto mais detalhes, mais rápido conseguimos te responder."
          className="w-full resize-y rounded-xl border border-slate-200 bg-white px-4 py-3 text-sm text-charcoal transition-all duration-200 placeholder:text-charcoal-muted/40 focus:border-primary/50 focus:outline-none focus:ring-[3px] focus:ring-primary/10"
        />
      </div>

      <div className="hidden" aria-hidden>
        <label htmlFor="help-website">Website</label>
        <input
          id="help-website"
          type="text"
          tabIndex={-1}
          autoComplete="off"
          value={website}
          onChange={(e) => setWebsite(e.target.value)}
        />
      </div>

      {(error || retryAfterSeconds != null) && (
        <div role="alert" className="flex items-start gap-3 rounded-xl border border-error/10 bg-error-light/50 px-4 py-3">
          <p className="text-sm text-error">
            {retryAfterSeconds != null ? <RateLimitMessage seconds={retryAfterSeconds} /> : error}
          </p>
        </div>
      )}

      <LoadingButton type="submit" loading={submitting} loadingLabel="Enviando…" fullWidth>
        Enviar
      </LoadingButton>
    </form>
  );
}

function HelpCard({
  initialName,
  initialEmail,
}: {
  initialName: string;
  initialEmail: string;
}) {
  return (
    <div className="rounded-2xl border border-slate-100 bg-white p-5 shadow-sm sm:p-8">
      <HelpForm initialName={initialName} initialEmail={initialEmail} />
    </div>
  );
}

function PublicHelpShell({ children }: { children: React.ReactNode }) {
  return (
    <div className="min-h-dvh bg-[#F8FAF9]">
      <header className="border-b border-slate-100 bg-white/90 px-4 py-4 backdrop-blur-md sm:px-6">
        <div className="mx-auto flex max-w-2xl items-center justify-between">
          <Link to="/" aria-label="Unithery — início">
            <img src={BRAND_LOGO_SRC} alt="Unithery" className="h-8 w-auto sm:h-9" />
          </Link>
          <Link
            to="/login"
            className="text-sm font-medium text-charcoal-muted transition-colors hover:text-charcoal"
          >
            Entrar
          </Link>
        </div>
      </header>
      <main className="mx-auto w-full max-w-2xl px-4 py-8 sm:px-6 sm:py-12">{children}</main>
    </div>
  );
}

export default function HelpContactContainer() {
  const { user } = useAuth();
  const firebaseName = getFirebaseCurrentUser()?.displayName?.trim() ?? '';

  const { data: settings } = useQuery({
    queryKey: ['clinic-settings'],
    queryFn: () =>
      callFunction<{
        admin_name?: string;
        owner_profile?: { name?: string };
      }>('get-clinic-settings', {}),
    enabled: Boolean(user) && user?.role !== 'family',
    retry: false,
    staleTime: 60_000,
  });

  const initialName =
    settings?.owner_profile?.name?.trim() ||
    settings?.admin_name?.trim() ||
    firebaseName ||
    '';
  const initialEmail = user?.email ?? '';

  const heading = (
    <>
      <p className="mb-1 text-[11px] font-semibold uppercase tracking-wider text-charcoal-muted/70">
        Ajuda
      </p>
      <h1 className="font-serif text-3xl font-medium tracking-tight text-charcoal sm:text-[2rem]">
        Fale conosco
      </h1>
      <p className="mt-2 text-sm leading-relaxed text-charcoal-muted">
        Conte o que você precisa. Nossa equipe responde em até 24 horas úteis.
      </p>
    </>
  );

  const card = <HelpCard initialName={initialName} initialEmail={initialEmail} />;

  if (user?.role === 'family') {
    return (
      <FamilyLayout>
        <div className="mx-auto w-full max-w-2xl">
          <PageHeader
            title="Fale conosco"
            subtitle="Nossa equipe responde em até 24 horas úteis."
            bleed={false}
          />
          <div className="mt-5">{card}</div>
        </div>
      </FamilyLayout>
    );
  }

  if (user) {
    return (
      <AppLayout>
        <div className="bg-[#F8FAF9] px-4 sm:px-6 lg:px-8">
          <PageHeader title="Fale conosco" subtitle="Nossa equipe responde em até 24 horas úteis." />
          <div className="mx-auto mt-5 max-w-2xl pb-8">{card}</div>
        </div>
      </AppLayout>
    );
  }

  return (
    <PublicHelpShell>
      <div className="mb-6">{heading}</div>
      {card}
    </PublicHelpShell>
  );
}
