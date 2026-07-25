import { useState } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import { BRAND_LOGO_SRC } from '@shared/lib/brand-assets';
import { TermsOfUseModal } from '@features/legal/TermsOfUseModal';
import {
  FAQS,
  FEATURES,
  HERO,
  PILLARS,
  PLANS,
  STATS,
  STEPS,
  TESTIMONIALS,
  TIMELINE_PREVIEW,
  WHY_ITEMS,
  type LandingPillar,
} from './landing-content';

const CONTACT_EMAIL = 'contact@unithery.com';

/* ---------- Ícones ---------- */

function FeatureIcon({ icon, className = 'h-5 w-5' }: { icon: LandingPillar['icon']; className?: string }) {
  const paths: Record<LandingPillar['icon'], React.ReactNode> = {
    brain: (
      <path
        strokeLinecap="round"
        strokeLinejoin="round"
        d="M9.75 3.104v5.714a2.25 2.25 0 01-.659 1.591L5 14.5M9.75 3.104c-.251.023-.501.05-.75.082m.75-.082a24.301 24.301 0 014.5 0m0 0v5.714c0 .597.237 1.17.659 1.591L19.8 15.3M14.25 3.104c.251.023.501.05.75.082M19.8 15.3l-1.57.393A9.065 9.065 0 0112 15a9.065 9.065 0 00-6.23-.693L5 14.5m14.8.8l1.402 1.402c1.232 1.232.65 3.318-1.067 3.611A48.309 48.309 0 0112 21c-2.773 0-5.491-.235-8.135-.687-1.718-.293-2.3-2.379-1.067-3.61L5 14.5"
      />
    ),
    home: (
      <path
        strokeLinecap="round"
        strokeLinejoin="round"
        d="M2.25 12l8.954-8.955c.44-.439 1.152-.439 1.591 0L21.75 12M4.5 9.75v10.125c0 .621.504 1.125 1.125 1.125H9.75v-4.875c0-.621.504-1.125 1.125-1.125h2.25c.621 0 1.125.504 1.125 1.125V21h4.125c.621 0 1.125-.504 1.125-1.125V9.75"
      />
    ),
    shield: (
      <path
        strokeLinecap="round"
        strokeLinejoin="round"
        d="M9 12.75L11.25 15 15 9.75m-3-7.036A11.959 11.959 0 013.598 6 11.99 11.99 0 003 9.749c0 5.592 3.824 10.29 9 11.623 5.176-1.332 9-6.03 9-11.622 0-1.31-.21-2.571-.598-3.751h-.152c-3.196 0-6.1-1.248-8.25-3.285z"
      />
    ),
    mic: (
      <path
        strokeLinecap="round"
        strokeLinejoin="round"
        d="M12 18.75a6 6 0 006-6v-1.5m-6 7.5a6 6 0 01-6-6v-1.5m6 7.5v3.75m-3.75 0h7.5M12 15.75a3 3 0 01-3-3V4.5a3 3 0 116 0v8.25a3 3 0 01-3 3z"
      />
    ),
    file: (
      <path
        strokeLinecap="round"
        strokeLinejoin="round"
        d="M19.5 14.25v-2.625a3.375 3.375 0 00-3.375-3.375h-1.5A1.125 1.125 0 0113.5 7.125v-1.5a3.375 3.375 0 00-3.375-3.375H8.25m2.25 0H5.625c-.621 0-1.125.504-1.125 1.125v17.25c0 .621.504 1.125 1.125 1.125h12.75c.621 0 1.125-.504 1.125-1.125V11.25a9 9 0 00-9-9z"
      />
    ),
    calendar: (
      <path
        strokeLinecap="round"
        strokeLinejoin="round"
        d="M6.75 3v2.25M17.25 3v2.25M3 18.75V7.5a2.25 2.25 0 012.25-2.25h13.5A2.25 2.25 0 0121 7.5v11.25m-18 0A2.25 2.25 0 005.25 21h13.5A2.25 2.25 0 0021 18.75m-18 0v-7.5A2.25 2.25 0 015.25 9h13.5A2.25 2.25 0 0121 11.25v7.5"
      />
    ),
    paperclip: (
      <path
        strokeLinecap="round"
        strokeLinejoin="round"
        d="M18.375 12.739l-7.693 7.693a4.5 4.5 0 01-6.364-6.364l10.94-10.94A3 3 0 1119.5 7.372L8.552 18.32m.009-.01l-.01.01m5.699-9.941l-7.81 7.81a1.5 1.5 0 002.112 2.13"
      />
    ),
    chat: (
      <path
        strokeLinecap="round"
        strokeLinejoin="round"
        d="M8.625 12a.375.375 0 11-.75 0 .375.375 0 01.75 0zm0 0H8.25m4.125 0a.375.375 0 11-.75 0 .375.375 0 01.75 0zm0 0H12m4.125 0a.375.375 0 11-.75 0 .375.375 0 01.75 0zm0 0h-.375M21 12c0 4.556-4.03 8.25-9 8.25a9.764 9.764 0 01-2.555-.337A5.972 5.972 0 015.41 20.97a5.969 5.969 0 01-.474-.065 4.48 4.48 0 00.978-2.025c.09-.457-.133-.901-.467-1.226C3.93 16.178 3 14.189 3 12c0-4.556 4.03-8.25 9-8.25s9 3.694 9 8.25z"
      />
    ),
  };

  return (
    <svg className={className} fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={1.5}>
      {paths[icon]}
    </svg>
  );
}

/* ---------- Fundo pastel (mesmo das telas de auth) ---------- */

const PASTEL_GRADIENT =
  'linear-gradient(145deg, #FDF8F4 0%, #F5EDE8 30%, #EDE4DC 60%, #F8F0EB 100%)';

/* ---------- Seções ---------- */

function AnnouncementBar() {
  return (
    <div className="bg-charcoal px-4 py-2.5">
      <div className="mx-auto flex max-w-6xl flex-col items-center justify-center gap-2 sm:flex-row sm:gap-4">
        <p className="text-center text-[11px] font-semibold uppercase tracking-wider text-white/90 sm:text-xs">
          Já faz parte do Unithery?
        </p>
        <Link
          to="/login"
          className="inline-flex h-7 items-center rounded-full bg-white px-4 text-[11px] font-bold uppercase tracking-wider text-charcoal transition-all hover:bg-primary hover:text-white sm:text-xs"
        >
          Logar
        </Link>
      </div>
    </div>
  );
}

function Header() {
  return (
    <header className="sticky top-0 z-40 border-b border-slate-100 bg-white/90 backdrop-blur-md">
      <div className="mx-auto flex h-16 max-w-6xl items-center justify-between px-4 sm:px-6">
        <a href="#inicio" aria-label="Unithery — início">
          <img src={BRAND_LOGO_SRC} alt="Unithery" className="h-8 w-auto sm:h-9" />
        </a>

        <nav className="hidden items-center gap-8 lg:flex" aria-label="Navegação principal">
          <a href="#funcionalidades" className="text-sm font-medium text-charcoal-muted transition-colors hover:text-charcoal">
            Funcionalidades
          </a>
          <a href="#como-funciona" className="text-sm font-medium text-charcoal-muted transition-colors hover:text-charcoal">
            Como funciona
          </a>
          <a href="#planos" className="text-sm font-medium text-charcoal-muted transition-colors hover:text-charcoal">
            Planos
          </a>
          <a href="#faq" className="text-sm font-medium text-charcoal-muted transition-colors hover:text-charcoal">
            Dúvidas
          </a>
        </nav>

        <div className="flex items-center gap-2 sm:gap-3">
          <Link
            to="/login"
            className="inline-flex h-10 items-center rounded-xl px-3 text-sm font-medium text-charcoal transition-colors hover:bg-slate-100 sm:px-4"
          >
            Entrar
          </Link>
          <Link
            to="/register"
            className="inline-flex h-10 items-center rounded-xl bg-charcoal px-4 text-sm font-semibold text-white shadow-sm transition-all hover:bg-charcoal-light active:scale-[0.98] sm:px-5"
          >
            Criar conta
          </Link>
        </div>
      </div>
    </header>
  );
}

function HeroSection() {
  return (
    <section id="inicio" className="relative overflow-hidden" style={{ background: PASTEL_GRADIENT }}>
      {/* Textura + formas orgânicas */}
      <div
        className="absolute inset-0 opacity-[0.03]"
        style={{
          backgroundImage: `url("data:image/svg+xml,%3Csvg xmlns='http://www.w3.org/2000/svg' width='4' height='4' viewBox='0 0 4 4'%3E%3Cpath fill='%23000000' fill-opacity='1' d='M1 3h1v1H1V3zm2-2h1v1H3V1z'%3E%3C/path%3E%3C/svg%3E")`,
        }}
      />
      <div className="pointer-events-none absolute inset-0">
        <svg className="absolute -left-20 -top-20 h-96 w-96 text-primary-100 opacity-40" viewBox="0 0 200 200" fill="currentColor">
          <path d="M47.5,-57.2C59.1,-46.8,64.5,-29.5,67.3,-11.7C70.1,6.2,70.2,24.5,62.1,38.2C54,51.9,37.6,61,20.3,65.8C3,70.5,-15.2,70.9,-30.8,64.7C-46.4,58.5,-59.3,45.7,-66.2,30.2C-73.1,14.7,-73.9,-3.5,-68.5,-19.3C-63,-35,-51.3,-48.3,-37.8,-58.2C-24.3,-68.1,-9,-74.7,4.9,-80.4C18.8,-86.1,35.9,-67.6,47.5,-57.2Z" transform="translate(100 100)" />
        </svg>
        <svg className="absolute -bottom-24 -right-16 h-80 w-80 text-ai-50 opacity-60" viewBox="0 0 200 200" fill="currentColor">
          <path d="M39.5,-48.6C52.9,-38.2,66.8,-27.5,71.2,-13.6C75.6,0.3,70.5,17.4,61.4,31.2C52.3,44.9,39.2,55.3,24.3,60.8C9.5,66.3,-7.1,66.9,-22.1,62C-37.1,57.1,-50.5,46.7,-58.8,33.1C-67.1,19.5,-70.3,2.8,-66.9,-12C-63.5,-26.9,-53.5,-39.9,-41.2,-50.5C-28.9,-61,-14.4,-69.1,-0.5,-68.5C13.5,-67.9,26.1,-59,39.5,-48.6Z" transform="translate(100 100)" />
        </svg>
        <div className="absolute left-1/4 top-1/4 h-3 w-3 rounded-full bg-alert/20" />
        <div className="absolute bottom-1/3 right-1/2 h-2 w-2 rounded-full bg-primary-200/40" />
      </div>

      <div className="relative z-10 mx-auto grid max-w-6xl gap-12 px-4 py-16 sm:px-6 lg:grid-cols-[1.1fr_0.9fr] lg:items-center lg:gap-10 lg:py-24">
        {/* Copy */}
        <div>
          <p className="inline-flex items-center gap-2 rounded-full border border-charcoal/10 bg-white/70 px-4 py-1.5 text-[11px] font-medium text-charcoal-muted backdrop-blur-sm sm:text-xs">
            <svg className="h-3.5 w-3.5 text-primary" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
              <path strokeLinecap="round" strokeLinejoin="round" d="M16.5 10.5V6.75a4.5 4.5 0 10-9 0v3.75m-.75 11.25h10.5a2.25 2.25 0 002.25-2.25v-6.75a2.25 2.25 0 00-2.25-2.25H6.75a2.25 2.25 0 00-2.25 2.25v6.75a2.25 2.25 0 002.25 2.25z" />
            </svg>
            {HERO.badge}
          </p>

          <h1 className="mt-6 font-serif text-4xl font-medium leading-[1.1] tracking-tight text-charcoal sm:text-5xl xl:text-6xl">
            {HERO.titleLines[0]}
            <br />
            <span className="italic text-primary-dark">{HERO.titleLines[1]}</span>{' '}
            {HERO.titleLines[2]}
          </h1>

          <p className="mt-6 max-w-xl text-base leading-relaxed text-charcoal-muted">
            {HERO.subtitle}
          </p>

          <div className="mt-8 flex flex-col gap-3 sm:flex-row sm:items-center">
            <Link
              to="/register"
              className="inline-flex h-12 items-center justify-center rounded-xl bg-charcoal px-7 text-sm font-semibold text-white shadow-elevated transition-all hover:bg-charcoal-light active:scale-[0.98]"
            >
              Começar teste gratuito
              <svg className="ml-2 h-4 w-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                <path strokeLinecap="round" strokeLinejoin="round" d="M13.5 4.5L21 12m0 0l-7.5 7.5M21 12H3" />
              </svg>
            </Link>
          </div>

          <ul className="mt-8 flex flex-wrap gap-x-6 gap-y-2">
            {HERO.trustMarkers.map((marker) => (
              <li key={marker} className="flex items-center gap-1.5 text-xs text-charcoal-muted">
                <svg className="h-4 w-4 text-mint-dark" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                  <path strokeLinecap="round" strokeLinejoin="round" d="M9 12.75L11.25 15 15 9.75M21 12a9 9 0 11-18 0 9 9 0 0118 0z" />
                </svg>
                {marker}
              </li>
            ))}
          </ul>
        </div>

        {/* Composição visual — linha do tempo real da plataforma (sem vídeo) */}
        <div className="relative mx-auto w-full max-w-md lg:max-w-none">
          <div className="relative rounded-3xl border border-white/60 bg-white/85 p-6 shadow-elevated backdrop-blur-sm">
            <p className="text-[10px] font-semibold uppercase tracking-[0.18em] text-charcoal-muted">
              Linha do tempo · pré-consulta
            </p>
            <ol className="mt-4 space-y-4">
              {TIMELINE_PREVIEW.map((entry, index) => (
                <li key={entry.title} className="relative flex gap-3">
                  <div className="flex flex-col items-center">
                    <span className={`mt-1 h-2.5 w-2.5 shrink-0 rounded-full ${index === 0 ? 'bg-primary' : 'bg-primary-200'}`} />
                    {index < TIMELINE_PREVIEW.length - 1 && <span className="mt-1 w-px flex-1 bg-slate-200" />}
                  </div>
                  <div className="pb-1">
                    <p className="text-[10px] font-medium uppercase tracking-wide text-charcoal-muted/70">{entry.time}</p>
                    <p className="mt-0.5 text-sm font-semibold text-charcoal">{entry.title}</p>
                    <p className="text-xs text-charcoal-muted">{entry.detail}</p>
                  </div>
                </li>
              ))}
            </ol>
            <div className="mt-4 flex items-center gap-2 rounded-xl bg-ai-50 px-3.5 py-2.5">
              <FeatureIcon icon="brain" className="h-4 w-4 shrink-0 text-ai" />
              <p className="text-xs text-charcoal">
                <span className="font-semibold">Padrão detectado:</span> crises após atraso na medicação.
              </p>
            </div>
          </div>

          {/* Chips flutuantes */}
          <div className="absolute -left-3 -top-4 animate-float rounded-2xl border border-slate-100 bg-white px-4 py-3 shadow-card sm:-left-8">
            <div className="flex items-center gap-2.5">
              <span className="flex h-8 w-8 items-center justify-center rounded-full bg-primary-50 text-primary">
                <FeatureIcon icon="mic" className="h-4 w-4" />
              </span>
              <div>
                <p className="text-xs font-semibold text-charcoal">Ditado pós-sessão</p>
                <p className="text-[11px] text-charcoal-muted">Relatório gerado em 12s</p>
              </div>
            </div>
          </div>
          <div className="absolute -bottom-4 -right-2 animate-float rounded-2xl border border-slate-100 bg-white px-4 py-3 shadow-card [animation-delay:1.5s] sm:-right-6">
            <div className="flex items-center gap-2.5">
              <span className="flex h-8 w-8 items-center justify-center rounded-full bg-mint-50 text-mint-dark">
                <svg className="h-4 w-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={1.8}>
                  <path strokeLinecap="round" strokeLinejoin="round" d="M2.25 18L9 11.25l4.306 4.307a11.95 11.95 0 015.814-5.519l2.74-1.22m0 0l-5.94-2.28m5.94 2.28l-2.28 5.941" />
                </svg>
              </span>
              <div>
                <p className="text-xs font-semibold text-charcoal">+38% engajamento</p>
                <p className="text-[11px] text-charcoal-muted">Famílias ativas / mês</p>
              </div>
            </div>
          </div>
        </div>
      </div>
    </section>
  );
}

function SectionHeading({ eyebrow, title, subtitle }: { eyebrow: string; title: string; subtitle?: string }) {
  return (
    <div className="mx-auto max-w-2xl text-center">
      <p className="text-[11px] font-semibold uppercase tracking-[0.2em] text-primary">{eyebrow}</p>
      <h2 className="mt-3 font-serif text-3xl font-medium tracking-tight text-charcoal sm:text-4xl">{title}</h2>
      {subtitle && <p className="mt-4 text-sm leading-relaxed text-charcoal-muted sm:text-base">{subtitle}</p>}
    </div>
  );
}

function PillarsSection() {
  return (
    <section id="beneficios" className="bg-white px-4 py-20 sm:px-6">
      <div className="mx-auto max-w-6xl">
        <SectionHeading eyebrow="As três grandes blindagens" title="Tudo que um copiloto clínico precisa entregar." />
        <div className="mt-12 grid gap-5 md:grid-cols-3">
          {PILLARS.map((pillar) => (
            <article key={pillar.id} className="rounded-3xl border border-slate-100 bg-white p-6 shadow-soft transition-shadow hover:shadow-card">
              <span className="inline-flex h-11 w-11 items-center justify-center rounded-2xl bg-charcoal text-white">
                <FeatureIcon icon={pillar.icon} />
              </span>
              <h3 className="mt-5 font-display text-base font-bold text-charcoal">{pillar.title}</h3>
              <p className="mt-2.5 text-sm leading-relaxed text-charcoal-muted">{pillar.description}</p>
            </article>
          ))}
        </div>
      </div>
    </section>
  );
}

function StepsSection() {
  return (
    <section id="como-funciona" className="px-4 py-20 sm:px-6" style={{ background: PASTEL_GRADIENT }}>
      <div className="mx-auto max-w-6xl">
        <SectionHeading
          eyebrow="O ecossistema em 3 passos"
          title="A ponte entre a casa da criança e o seu consultório."
          subtitle="Você deixa de tratar às cegas o que aconteceu na semana. A IA organiza, você conduz — e a família participa no ritmo que você definir."
        />
        <div className="relative mt-14 grid gap-10 md:grid-cols-3 md:gap-6">
          {/* Linha conectora (desktop) */}
          <div className="absolute left-[16%] right-[16%] top-7 hidden border-t border-dashed border-charcoal/15 md:block" />
          {STEPS.map((step) => (
            <article key={step.number} className="relative text-center md:text-left">
              <div className="relative z-10 mx-auto flex h-14 w-14 items-center justify-center rounded-2xl border border-slate-100 bg-white text-primary shadow-card md:mx-0">
                <FeatureIcon icon={step.icon} className="h-6 w-6" />
              </div>
              <div className="mt-5 flex items-baseline justify-center gap-2 md:justify-start">
                <span className="font-serif text-2xl font-medium text-charcoal/30">{step.number}</span>
                <div>
                  <p className="text-[10px] font-semibold uppercase tracking-[0.18em] text-primary">{step.actor}</p>
                  <h3 className="font-display text-base font-bold text-charcoal">{step.title}</h3>
                </div>
              </div>
              <p className="mt-3 text-sm leading-relaxed text-charcoal-muted">{step.description}</p>
            </article>
          ))}
        </div>
      </div>
    </section>
  );
}

function FeaturesSection() {
  return (
    <section id="funcionalidades" className="bg-white px-4 py-20 sm:px-6">
      <div className="mx-auto max-w-6xl">
        <SectionHeading
          eyebrow="Painel de bordo clínico"
          title="Funcionalidades que viram tempo livre."
          subtitle="Do laudo anexado ao relatório final: cada etapa do caso organizada, pesquisável e pronta antes de você abrir a porta do consultório."
        />
        <div className="mt-12 grid gap-5 sm:grid-cols-2 lg:grid-cols-3">
          {FEATURES.map((feature) => (
            <article
              key={feature.id}
              className="group rounded-3xl border border-slate-100 bg-white p-6 shadow-soft transition-all hover:-translate-y-0.5 hover:shadow-card"
            >
              <span className="inline-flex h-11 w-11 items-center justify-center rounded-2xl bg-primary-50 text-primary transition-colors group-hover:bg-primary group-hover:text-white">
                <FeatureIcon icon={feature.icon} />
              </span>
              <h3 className="mt-5 font-display text-base font-bold text-charcoal">{feature.title}</h3>
              <p className="mt-2.5 text-sm leading-relaxed text-charcoal-muted">{feature.description}</p>
            </article>
          ))}
        </div>
      </div>
    </section>
  );
}

function WhySection() {
  return (
    <section className="bg-charcoal px-4 py-20 sm:px-6">
      <div className="mx-auto max-w-6xl">
        <div className="mx-auto max-w-2xl text-center">
          <p className="text-[11px] font-semibold uppercase tracking-[0.2em] text-primary-200">Para terapeutas autônomos</p>
          <h2 className="mt-3 font-serif text-3xl font-medium tracking-tight text-white sm:text-4xl">
            Por que terapeutas escolhem a Unithery?
          </h2>
        </div>
        <div className="mt-12 grid gap-5 md:grid-cols-3">
          {WHY_ITEMS.map((item) => (
            <article key={item.id} className="rounded-3xl border border-white/10 bg-white/5 p-6 backdrop-blur-sm">
              <span className="inline-flex h-11 w-11 items-center justify-center rounded-2xl bg-white/10 text-primary-200">
                <FeatureIcon icon={item.icon} />
              </span>
              <h3 className="mt-5 font-display text-base font-bold text-white">{item.title}</h3>
              <p className="mt-2.5 text-sm leading-relaxed text-white/70">{item.description}</p>
            </article>
          ))}
        </div>
      </div>
    </section>
  );
}

function TestimonialsSection() {
  return (
    <section className="px-4 py-20 sm:px-6" style={{ background: PASTEL_GRADIENT }}>
      <div className="mx-auto max-w-6xl">
        <SectionHeading eyebrow="Quem já usa" title="Terapeutas que devolveram o tempo às suas próprias vidas." />
        <div className="mt-12 grid gap-5 md:grid-cols-3">
          {TESTIMONIALS.map((testimonial) => (
            <figure key={testimonial.name} className="flex flex-col rounded-3xl border border-slate-100 bg-white p-6 shadow-soft">
              <svg className="h-7 w-7 text-primary-200" fill="currentColor" viewBox="0 0 24 24">
                <path d="M9.983 3v7.391c0 5.704-3.731 9.57-8.983 10.609l-.995-2.151c2.432-.917 3.995-3.638 3.995-5.849h-4v-10h9.983zm14.017 0v7.391c0 5.704-3.748 9.571-9 10.609l-.996-2.151c2.433-.917 3.996-3.638 3.996-5.849h-3.983v-10h9.983z" />
              </svg>
              <blockquote className="mt-4 flex-1 text-sm leading-relaxed text-charcoal">
                “{testimonial.quote}”
              </blockquote>
              <div className="mt-4 flex gap-0.5" aria-label="5 de 5 estrelas">
                {Array.from({ length: 5 }).map((_, i) => (
                  <svg key={i} className="h-4 w-4 text-alert" fill="currentColor" viewBox="0 0 20 20">
                    <path d="M9.049 2.927c.3-.921 1.603-.921 1.902 0l1.286 3.958a1 1 0 00.95.69h4.162c.969 0 1.371 1.24.588 1.81l-3.367 2.446a1 1 0 00-.363 1.118l1.286 3.958c.3.921-.755 1.688-1.539 1.118l-3.367-2.446a1 1 0 00-1.175 0l-3.367 2.446c-.783.57-1.838-.197-1.538-1.118l1.285-3.958a1 1 0 00-.363-1.118L2.075 9.385c-.783-.57-.38-1.81.588-1.81h4.162a1 1 0 00.95-.69l1.274-3.958z" />
                  </svg>
                ))}
              </div>
              <figcaption className="mt-4 border-t border-slate-100 pt-4">
                <p className="text-sm font-semibold text-charcoal">{testimonial.name}</p>
                <p className="text-xs text-charcoal-muted">{testimonial.role}</p>
              </figcaption>
            </figure>
          ))}
        </div>
      </div>
    </section>
  );
}

function PlansSection() {
  const [billing, setBilling] = useState<'mensal' | 'anual'>('mensal');

  return (
    <section id="planos" className="bg-white px-4 py-20 sm:px-6">
      <div className="mx-auto max-w-5xl">
        <SectionHeading eyebrow="Planos" title="Escolha o plano que cresce com você." />

        {/* Toggle mensal/anual */}
        <div className="mt-8 flex items-center justify-center gap-3">
          <span className={`text-sm font-medium ${billing === 'mensal' ? 'text-charcoal' : 'text-charcoal-muted'}`}>Mensal</span>
          <button
            type="button"
            role="switch"
            aria-checked={billing === 'anual'}
            aria-label="Alternar entre cobrança mensal e anual"
            onClick={() => setBilling(billing === 'mensal' ? 'anual' : 'mensal')}
            className={`relative h-7 w-12 rounded-full transition-colors ${billing === 'anual' ? 'bg-primary' : 'bg-slate-200'}`}
          >
            <span
              className={`absolute top-1 h-5 w-5 rounded-full bg-white shadow-sm transition-all ${billing === 'anual' ? 'left-6' : 'left-1'}`}
            />
          </button>
          <span className={`text-sm font-medium ${billing === 'anual' ? 'text-charcoal' : 'text-charcoal-muted'}`}>Anual</span>
          <span className="rounded-full bg-mint-50 px-2.5 py-0.5 text-[11px] font-semibold text-mint-dark">economize</span>
        </div>

        <div className="mt-10 grid gap-6 sm:grid-cols-2 xl:grid-cols-4">
          {PLANS.map((plan) => (
            <article
              key={plan.id}
              className={`relative flex flex-col rounded-3xl border bg-white p-6 ${
                plan.highlighted
                  ? 'border-primary/30 shadow-elevated ring-1 ring-primary/20'
                  : 'border-slate-100 shadow-soft'
              }`}
            >
              {plan.highlighted && (
                <span className="absolute -top-3 left-6 rounded-full bg-primary px-3 py-1 text-[11px] font-bold uppercase tracking-wide text-white">
                  Mais vendido
                </span>
              )}
              <h3 className="font-serif text-xl font-medium text-charcoal">{plan.name}</h3>
              <p className="mt-1.5 text-sm text-charcoal-muted">{plan.tagline}</p>

              <div className="mt-6 flex items-baseline gap-1.5">
                <span className="font-serif text-3xl font-medium text-charcoal">
                  {billing === 'mensal' ? plan.monthlyPrice : plan.annualPrice}
                </span>
                {!plan.isFree && <span className="text-sm text-charcoal-muted">/mês</span>}
              </div>
              <p className="mt-1 min-h-[2rem] text-xs text-charcoal-muted">
                {plan.isFree
                  ? 'para sempre · sem cartão de crédito'
                  : billing === 'mensal'
                    ? `ou ${plan.annualPrice}/mês no anual (12% off)`
                    : `12x de ${plan.annualPrice} no cartão · total ${plan.annualTotal}/ano`}
              </p>

              <ul className="mt-5 flex-1 space-y-2.5">
                {plan.features.map((feature) => (
                  <li key={feature} className="flex items-start gap-2 text-[13px] leading-snug text-charcoal">
                    <svg className="mt-0.5 h-4 w-4 shrink-0 text-mint-dark" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                      <path strokeLinecap="round" strokeLinejoin="round" d="M4.5 12.75l6 6 9-13.5" />
                    </svg>
                    {feature}
                  </li>
                ))}
              </ul>

              <Link
                to="/register"
                className={`mt-7 inline-flex h-11 items-center justify-center rounded-xl text-sm font-semibold transition-all active:scale-[0.98] ${
                  plan.highlighted
                    ? 'bg-primary text-white shadow-sm hover:bg-primary-dark'
                    : 'border border-charcoal/15 bg-white text-charcoal hover:border-charcoal/30'
                }`}
              >
                {plan.cta}
                <svg className="ml-2 h-4 w-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                  <path strokeLinecap="round" strokeLinejoin="round" d="M13.5 4.5L21 12m0 0l-7.5 7.5M21 12H3" />
                </svg>
              </Link>
            </article>
          ))}
        </div>

        <p className="mt-8 text-center text-xs text-charcoal-muted">
          Planos pagos começam com 14 dias grátis · Cancele quando quiser, direto na plataforma ·
          Anual em 12x com 12% de desconto
        </p>
      </div>
    </section>
  );
}

function FaqSection() {
  const [openIndex, setOpenIndex] = useState<number | null>(0);

  return (
    <section id="faq" className="px-4 py-20 sm:px-6" style={{ background: PASTEL_GRADIENT }}>
      <div className="mx-auto max-w-3xl">
        <SectionHeading eyebrow="Dúvidas frequentes" title="Tudo o que você quer saber antes de começar." />
        <div className="mt-10 space-y-3">
          {FAQS.map((faq, index) => {
            const open = openIndex === index;
            return (
              <div key={faq.question} className="overflow-hidden rounded-2xl border border-slate-100 bg-white shadow-soft">
                <button
                  type="button"
                  onClick={() => setOpenIndex(open ? null : index)}
                  aria-expanded={open}
                  className="flex w-full items-center justify-between gap-4 px-5 py-4 text-left"
                >
                  <span className="font-display text-sm font-semibold text-charcoal">{faq.question}</span>
                  <span className={`shrink-0 text-primary transition-transform ${open ? 'rotate-45' : ''}`}>
                    <svg className="h-5 w-5" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                      <path strokeLinecap="round" strokeLinejoin="round" d="M12 4.5v15m7.5-7.5h-15" />
                    </svg>
                  </span>
                </button>
                {open && (
                  <p className="border-t border-slate-50 px-5 pb-5 pt-4 text-sm leading-relaxed text-charcoal-muted">
                    {faq.answer}
                  </p>
                )}
              </div>
            );
          })}
        </div>
      </div>
    </section>
  );
}

function FinalCtaSection() {
  return (
    <section className="bg-white px-4 py-20 sm:px-6">
      <div className="mx-auto max-w-6xl overflow-hidden rounded-3xl bg-charcoal">
        <div className="relative grid gap-10 p-8 sm:p-12 lg:grid-cols-[1.2fr_0.8fr] lg:items-center lg:p-16">
          <div
            className="pointer-events-none absolute inset-0 opacity-[0.06]"
            style={{
              backgroundImage: `url("data:image/svg+xml,%3Csvg xmlns='http://www.w3.org/2000/svg' width='24' height='24' viewBox='0 0 24 24'%3E%3Ccircle cx='2' cy='2' r='1' fill='white'/%3E%3C/svg%3E")`,
            }}
          />
          <div className="relative">
            <p className="text-[11px] font-semibold uppercase tracking-[0.2em] text-primary-200">Pronto para começar?</p>
            <h2 className="mt-3 font-serif text-3xl font-medium leading-tight tracking-tight text-white sm:text-4xl">
              Devolva horas à sua semana.
              <br />
              Comece o teste gratuito hoje.
            </h2>
            <p className="mt-4 max-w-md text-sm leading-relaxed text-white/70">
              Sem cartão de crédito. Configure seu consultório em minutos e veja o primeiro relatório gerado por IA na próxima sessão.
            </p>
            <div className="mt-8">
              <Link
                to="/register"
                className="inline-flex h-12 items-center justify-center rounded-xl bg-white px-7 text-sm font-semibold text-charcoal shadow-elevated transition-all hover:bg-primary hover:text-white active:scale-[0.98]"
              >
                Começar teste gratuito
                <svg className="ml-2 h-4 w-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                  <path strokeLinecap="round" strokeLinejoin="round" d="M13.5 4.5L21 12m0 0l-7.5 7.5M21 12H3" />
                </svg>
              </Link>
            </div>
            <ul className="mt-6 flex flex-wrap gap-x-5 gap-y-2 text-xs text-white/60">
              <li>LGPD-ready</li>
              <li>Sem cartão de crédito</li>
              <li>Setup em minutos</li>
            </ul>
          </div>

          <div className="relative space-y-4">
            {STATS.map((stat) => (
              <div key={stat.value} className="rounded-2xl border border-white/10 bg-white/5 px-6 py-5 backdrop-blur-sm">
                <p className="font-serif text-3xl font-medium text-white">{stat.value}</p>
                <p className="mt-1 text-xs text-white/60">{stat.label}</p>
              </div>
            ))}
          </div>
        </div>
      </div>
    </section>
  );
}

function Footer({ onOpenTerms }: { onOpenTerms: () => void }) {
  return (
    <footer className="border-t border-slate-100 bg-white px-4 py-12 sm:px-6">
      <div className="mx-auto flex max-w-6xl flex-col items-center gap-8 md:flex-row md:items-start md:justify-between">
        <div className="text-center md:text-left">
          <img src={BRAND_LOGO_SRC} alt="Unithery" className="mx-auto h-9 w-auto md:mx-0" />
          <p className="mt-3 max-w-xs text-xs leading-relaxed text-charcoal-muted">
            Inteligência Artificial Aplicada ao Desenvolvimento Humano.
          </p>
        </div>

        <nav className="flex flex-col items-center gap-2.5 md:items-end" aria-label="Links legais">
          <button
            type="button"
            onClick={onOpenTerms}
            className="text-sm font-medium text-charcoal underline decoration-charcoal/20 underline-offset-4 transition-colors hover:text-primary"
          >
            Contrato de Adesão e Termo de Uso Integrado
          </button>
          <a
            href={`mailto:${CONTACT_EMAIL}`}
            className="text-sm text-charcoal-muted transition-colors hover:text-charcoal"
          >
            Contato — {CONTACT_EMAIL}
          </a>
        </nav>
      </div>

      <div className="mx-auto mt-10 max-w-6xl border-t border-slate-100 pt-6 text-center">
        <p className="text-xs text-charcoal-muted/60">
          Unithery © 2026 — Inteligência Artificial Aplicada ao Desenvolvimento Humano. Em conformidade com a LGPD.
        </p>
      </div>
    </footer>
  );
}

/* ---------- Página ---------- */

export default function LandingPageContainer() {
  const navigate = useNavigate();
  const [termsOpen, setTermsOpen] = useState(false);

  return (
    <div className="min-h-dvh bg-white font-sans">
      <AnnouncementBar />
      <Header />
      <main>
        <HeroSection />
        <PillarsSection />
        <StepsSection />
        <FeaturesSection />
        <WhySection />
        <TestimonialsSection />
        <PlansSection />
        <FaqSection />
        <FinalCtaSection />
      </main>
      <Footer onOpenTerms={() => setTermsOpen(true)} />

      <TermsOfUseModal
        isOpen={termsOpen}
        onClose={() => setTermsOpen(false)}
        onAccept={() => {
          setTermsOpen(false);
          navigate('/register');
        }}
        acceptLabel="Aceitar e acessar a plataforma"
      />
    </div>
  );
}
