import { useState } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import banner2 from '@/assets/banner2.jpg';
import ctaTerapia from '@/assets/cta-terapia.jpg';
import liviaPavarini from '@/assets/imagemlivia.jpeg';
import { BRAND_LOGO_SRC } from '@shared/lib/brand-assets';
import { TermsOfUseModal } from '@features/legal/TermsOfUseModal';
import {
  FAQS,
  FINAL_CTA,
  FREE_PLAN,
  HELP_LINK,
  HERO,
  LEGAL_ENTITY,
  NAV_LINKS,
  PAID_PLANS,
  PILLARS,
  PLANS_FOOTNOTE,
  SOCIAL_PROOF,
  STEPS,
  WHY_ITEMS,
} from './landing-content';
import { ArrowRight, LandingIconMark, LinkedInIcon } from './landing-icons';
import { FeatureShowcase } from './landing-showcase';
import { landingPlanPriceView } from './landing-plans.utils';
import { Reveal } from './landing-reveal';
import { HeroTimelineCard } from './landing-timeline';

function SectionHeading({
  eyebrow,
  title,
  subtitle,
  light = false,
  from = 'left',
}: {
  eyebrow: string;
  title: string;
  subtitle?: string;
  light?: boolean;
  from?: 'left' | 'right';
}) {
  return (
    <Reveal from={from} className="mx-auto max-w-2xl text-center">
      <p className={`text-[11px] font-semibold uppercase tracking-[0.2em] ${light ? 'text-primary-200' : 'text-primary'}`}>
        {eyebrow}
      </p>
      <h2
        className={`mt-3 font-serif text-3xl font-medium tracking-tight sm:text-4xl ${
          light ? 'text-white' : 'text-charcoal'
        }`}
      >
        {title}
      </h2>
      {subtitle && (
        <p className={`mt-4 text-sm leading-relaxed sm:text-base ${light ? 'text-white/70' : 'text-charcoal-muted'}`}>
          {subtitle}
        </p>
      )}
    </Reveal>
  );
}

function Header() {
  const [open, setOpen] = useState(false);

  return (
    <header className="sticky top-0 z-40 border-b border-slate-100/80 bg-white/90 backdrop-blur-md">
      <div className="relative mx-auto flex h-16 max-w-6xl items-center justify-between px-4 sm:px-6">
        <a href="#inicio" aria-label="Unithery — início" className="relative z-10">
          <img src={BRAND_LOGO_SRC} alt="Unithery" className="h-8 w-auto sm:h-9" />
        </a>

        <nav className="absolute left-1/2 hidden -translate-x-1/2 items-center gap-8 lg:flex" aria-label="Navegação principal">
          {NAV_LINKS.map((link) => (
            <a
              key={link.href}
              href={link.href}
              className="text-sm font-medium text-charcoal-muted transition-colors hover:text-charcoal"
            >
              {link.label}
            </a>
          ))}
          <Link
            to={HELP_LINK.to}
            className="text-sm font-medium text-charcoal-muted transition-colors hover:text-charcoal"
          >
            {HELP_LINK.label}
          </Link>
        </nav>

        <div className="relative z-10 flex items-center gap-2 sm:gap-3">
          <Link
            to="/login"
            className="inline-flex h-10 items-center px-2 text-sm font-medium text-charcoal transition-colors hover:text-primary sm:px-3"
          >
            Entrar
          </Link>
          <Link
            to="/register"
            className="inline-flex h-10 items-center rounded-full bg-charcoal px-4 text-sm font-semibold text-white transition-all hover:bg-charcoal-light active:scale-[0.98] sm:px-5"
          >
            Criar conta
          </Link>
          <button
            type="button"
            className="inline-flex h-10 w-10 items-center justify-center rounded-xl text-charcoal lg:hidden"
            aria-expanded={open}
            aria-label={open ? 'Fechar menu' : 'Abrir menu'}
            onClick={() => setOpen((v) => !v)}
          >
            <svg className="h-5 w-5" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={1.8}>
              {open ? (
                <path strokeLinecap="round" strokeLinejoin="round" d="M6 18L18 6M6 6l12 12" />
              ) : (
                <path strokeLinecap="round" strokeLinejoin="round" d="M4 6h16M4 12h16M4 18h16" />
              )}
            </svg>
          </button>
        </div>
      </div>

      {open && (
        <nav className="border-t border-slate-100 bg-white px-4 py-3 lg:hidden" aria-label="Navegação mobile">
          <div className="mx-auto flex max-w-6xl flex-col gap-1">
            {NAV_LINKS.map((link) => (
              <a
                key={link.href}
                href={link.href}
                onClick={() => setOpen(false)}
                className="rounded-xl px-3 py-2.5 text-sm font-medium text-charcoal hover:bg-slate-50"
              >
                {link.label}
              </a>
            ))}
            <Link
              to={HELP_LINK.to}
              onClick={() => setOpen(false)}
              className="rounded-xl px-3 py-2.5 text-sm font-medium text-charcoal hover:bg-slate-50"
            >
              {HELP_LINK.label}
            </Link>
          </div>
        </nav>
      )}
    </header>
  );
}

function HeroSection() {
  return (
    <section id="inicio" className="relative overflow-hidden bg-brand-warm">
      <div className="pointer-events-none absolute inset-0" aria-hidden>
        <div className="absolute -left-24 -top-28 h-[28rem] w-[28rem] rounded-full bg-[#DCEBFA] blur-3xl" />
        <div className="absolute -right-16 top-10 h-[26rem] w-[26rem] rounded-full bg-[#F3EBE3] blur-3xl" />
      </div>

      <div className="relative z-10 mx-auto grid max-w-6xl gap-12 px-4 py-16 sm:px-6 lg:grid-cols-[1.05fr_0.95fr] lg:items-center lg:gap-12 lg:py-24">
        <Reveal from="left">
          <p className="inline-flex items-center gap-2 rounded-full bg-white/90 px-3.5 py-1.5 text-xs font-medium text-charcoal shadow-sm ring-1 ring-slate-200/70">
            <LandingIconMark icon="sparkle" className="h-3.5 w-3.5 text-primary" />
            {HERO.badge}
          </p>

          <h1 className="mt-5 font-serif text-4xl font-medium leading-[1.12] tracking-tight text-charcoal sm:text-5xl xl:text-[3.35rem]">
            {HERO.titleBefore}
            <em className="italic font-medium">{HERO.titleEmphasis}</em>
            {HERO.titleAfter}
          </h1>

          <p className="mt-5 max-w-xl text-lg font-semibold leading-snug text-charcoal">{HERO.lead}</p>
          <p className="mt-3 max-w-xl text-sm leading-relaxed text-charcoal-muted sm:text-base">{HERO.body}</p>
          <p className="mt-3 max-w-xl text-sm text-charcoal-muted">{HERO.audience}</p>

          <div className="mt-8">
            <Link
              to="/register"
              className="inline-flex h-12 items-center justify-center rounded-xl bg-primary px-7 text-sm font-semibold text-white shadow-sm transition-all hover:bg-primary-dark active:scale-[0.98]"
            >
              {HERO.cta}
              <ArrowRight className="ml-2 h-4 w-4" />
            </Link>
          </div>

          <ul className="mt-8 flex flex-wrap gap-x-6 gap-y-2">
            {HERO.trustMarkers.map((marker) => (
              <li key={marker} className="flex items-center gap-2 text-xs text-charcoal-muted sm:text-sm">
                <span className="flex h-5 w-5 items-center justify-center rounded-full bg-mint/15 text-mint-dark">
                  <LandingIconMark icon="check" className="h-3 w-3" />
                </span>
                {marker}
              </li>
            ))}
          </ul>
        </Reveal>

        <Reveal from="left" delayMs={140} className="mx-auto w-full max-w-md lg:max-w-none">
          <HeroTimelineCard />
        </Reveal>
      </div>
    </section>
  );
}

function PillarsSection() {
  return (
    <section className="bg-white px-4 py-20 sm:px-6">
      <div className="mx-auto max-w-6xl">
        <SectionHeading from="right" eyebrow="Privacidade e conformidade" title="As três grandes blindagens" />
        <div className="mt-14 grid gap-10 md:grid-cols-3 md:gap-8">
          {PILLARS.map((pillar, index) => (
            <Reveal key={pillar.id} from="right" delayMs={index * 90}>
              <article className="text-center">
                <span className="mx-auto flex h-14 w-14 items-center justify-center rounded-full bg-primary-50 text-primary">
                  <LandingIconMark icon={pillar.icon} className="h-6 w-6" />
                </span>
                <h3 className="mt-5 font-display text-base font-semibold text-charcoal">{pillar.title}</h3>
                <p className="mt-2 text-sm leading-relaxed text-charcoal-muted">{pillar.description}</p>
              </article>
            </Reveal>
          ))}
        </div>
      </div>
    </section>
  );
}

function StepsSection() {
  return (
    <section id="como-funciona" className="scroll-mt-16 bg-brand-mist px-4 py-20 sm:px-6">
      <div className="mx-auto max-w-6xl">
        <SectionHeading
          from="left"
          eyebrow="O ecossistema em 3 passos"
          title="A ponte entre a casa da criança e o seu consultório."
          subtitle="Você deixa de tratar às cegas o que aconteceu na semana. A IA organiza, você conduz — e a família participa no ritmo que você definir."
        />
        <div className="relative mt-16 grid gap-12 md:grid-cols-3 md:gap-8">
          <div className="absolute left-[16%] right-[16%] top-7 hidden border-t border-dashed border-charcoal/15 md:block" />
          {STEPS.map((step, index) => (
            <Reveal key={step.number} from="left" delayMs={index * 100}>
              <article className="relative text-center">
                <div className="relative z-10 mx-auto flex h-14 w-14 items-center justify-center rounded-full border border-white bg-white text-charcoal shadow-sm">
                  <LandingIconMark icon={step.icon} className="h-6 w-6" />
                </div>
                <div className="mt-6 flex items-baseline justify-center gap-2.5">
                  <p className="font-serif text-3xl font-medium text-charcoal/20">{step.number}</p>
                  <p className="text-[11px] font-semibold uppercase tracking-[0.18em] text-primary">{step.actor}</p>
                </div>
                <h3 className="mt-2 font-display text-base font-semibold text-charcoal">{step.title}</h3>
                <p className="mt-3 text-sm leading-relaxed text-charcoal-muted">{step.description}</p>
              </article>
            </Reveal>
          ))}
        </div>
      </div>
    </section>
  );
}

function FeaturesSection() {
  return (
    <section id="funcionalidades" className="scroll-mt-16 bg-white px-4 py-20 sm:px-6">
      <div className="mx-auto max-w-6xl">
        <SectionHeading
          from="right"
          eyebrow="Painel de bordo clínico"
          title="Funcionalidades que viram tempo livre."
          subtitle="Do laudo anexado ao relatório final: cada etapa do caso organizada, pesquisável e pronta antes de você abrir a porta do consultório."
        />
        <FeatureShowcase />
      </div>
    </section>
  );
}

function WhySection() {
  return (
    <section className="bg-charcoal px-4 py-20 sm:px-6">
      <div className="mx-auto max-w-6xl">
        <SectionHeading from="left" eyebrow="Para terapeutas autônomos" title="Por que terapeutas escolhem a Unithery?" light />
        <div className="mt-12 grid items-stretch gap-5 md:grid-cols-3">
          {WHY_ITEMS.map((item, index) => (
            <Reveal key={item.id} from="left" delayMs={index * 90} className="h-full">
              <article className="flex h-full flex-col rounded-2xl border border-white/10 bg-white/[0.06] p-6">
                <span className="inline-flex h-10 w-10 items-center justify-center rounded-full bg-white/10 text-primary-200">
                  <LandingIconMark icon={item.icon} />
                </span>
                <h3 className="mt-5 min-h-[3.25rem] font-display text-base font-semibold leading-snug text-white">
                  {item.title}
                </h3>
                <p className="mt-2.5 flex-1 text-sm leading-relaxed text-white/70">{item.description}</p>
              </article>
            </Reveal>
          ))}
        </div>
      </div>
    </section>
  );
}

function TestimonialsSection() {
  const { testimonial, stats } = SOCIAL_PROOF;

  return (
    <section className="bg-brand-warm px-4 py-20 sm:px-6">
      <div className="mx-auto max-w-6xl">
        <SectionHeading
          from="right"
          eyebrow={SOCIAL_PROOF.eyebrow}
          title={SOCIAL_PROOF.title}
          subtitle={SOCIAL_PROOF.subtitle}
        />

        <Reveal from="right" delayMs={80} className="mt-12 w-full">
          <article className="w-full overflow-hidden rounded-[28px] bg-white shadow-[0_18px_50px_rgba(15,23,42,0.08)] lg:grid lg:grid-cols-[minmax(0,1.45fr)_minmax(16.5rem,0.85fr)]">
            <figure className="relative flex flex-col px-6 py-7 sm:px-9 sm:py-8">
              <div className="flex gap-0.5" aria-label="5 de 5 estrelas">
                {Array.from({ length: 5 }).map((_, i) => (
                  <svg key={i} className="h-4 w-4 text-alert" fill="currentColor" viewBox="0 0 20 20" aria-hidden>
                    <path d="M9.049 2.927c.3-.921 1.603-.921 1.902 0l1.286 3.958a1 1 0 00.95.69h4.162c.969 0 1.371 1.24.588 1.81l-3.367 2.446a1 1 0 00-.363 1.118l1.286 3.958c.3.921-.755 1.688-1.539 1.118l-3.367-2.446a1 1 0 00-1.175 0l-3.367 2.446c-.783.57-1.838-.197-1.538-1.118l1.285-3.958a1 1 0 00-.363-1.118L2.075 9.385c-.783-.57-.38-1.81.588-1.81h4.162a1 1 0 00.95-.69l1.274-3.958z" />
                  </svg>
                ))}
              </div>

              <blockquote className="relative z-10 mt-5 text-sm leading-relaxed text-charcoal sm:text-[15px] sm:leading-[1.7]">
                “{testimonial.quote}”
              </blockquote>

              <figcaption className="relative z-10 mt-8 flex items-center gap-3">
                <img
                  src={liviaPavarini}
                  alt={testimonial.photoAlt}
                  width={44}
                  height={44}
                  className="h-11 w-11 shrink-0 rounded-full object-cover"
                />
                <span className="min-w-0 flex-1">
                  <p className="text-sm font-semibold text-charcoal">{testimonial.name}</p>
                  <p className="text-xs text-charcoal-muted">{testimonial.role}</p>
                </span>
                <a
                  href={testimonial.linkedinUrl}
                  target="_blank"
                  rel="noopener noreferrer"
                  aria-label={`LinkedIn de ${testimonial.name}`}
                  className="inline-flex h-9 w-9 shrink-0 items-center justify-center rounded-full bg-[#0A66C2] text-white transition-opacity hover:opacity-90"
                >
                  <LinkedInIcon className="h-4 w-4" />
                </a>
              </figcaption>

              <span
                className="pointer-events-none absolute bottom-4 right-6 font-serif text-8xl leading-none text-primary-50 sm:bottom-5 sm:right-8 sm:text-[7.5rem]"
                aria-hidden
              >
                ”
              </span>
            </figure>

            <aside className="landing-stats-banner relative isolate overflow-hidden bg-charcoal px-7 py-8 text-white sm:px-8 lg:py-10">
              <img
                src={banner2}
                alt=""
                aria-hidden
                loading="lazy"
                decoding="async"
                className="landing-stats-photo"
              />
              <div className="landing-stats-fade" aria-hidden />
              <span
                className="pointer-events-none absolute -right-10 -top-16 z-[3] h-44 w-44 rounded-full bg-primary/25 blur-3xl"
                aria-hidden
              />
              <ul className="relative z-[4] flex h-full flex-col justify-center gap-8">
                {stats.map((stat, index) => (
                  <li
                    key={stat.value}
                    className={index > 0 ? 'border-t border-white/10 pt-8' : undefined}
                  >
                    <LandingIconMark icon={stat.icon} className="h-5 w-5 text-white/80" />
                    <p className="mt-3 font-serif text-4xl font-medium tracking-tight sm:text-5xl">{stat.value}</p>
                    <p className="mt-1.5 max-w-[14rem] text-xs leading-relaxed text-white/65">{stat.label}</p>
                  </li>
                ))}
              </ul>
            </aside>
          </article>
        </Reveal>
      </div>
    </section>
  );
}

function PlansSection() {
  const [billing, setBilling] = useState<'mensal' | 'anual'>('anual');

  return (
    <section id="planos" className="scroll-mt-16 bg-white px-4 py-20 sm:px-6">
      <div className="mx-auto max-w-6xl">
        <SectionHeading
          from="left"
          eyebrow="Planos"
          title="Escolha o plano que melhor te atende."
          subtitle="O plano anual é a opção recomendada: 12x com desconto, no tamanho da sua carteira de pacientes."
        />

        <div className="mt-8 flex items-center justify-center gap-3">
          <span className={`text-sm font-medium ${billing === 'mensal' ? 'text-charcoal' : 'text-charcoal-muted'}`}>
            Mensal
          </span>
          <button
            type="button"
            role="switch"
            aria-checked={billing === 'anual'}
            aria-label="Alternar entre cobrança mensal e anual"
            onClick={() => setBilling(billing === 'mensal' ? 'anual' : 'mensal')}
            className={`relative h-7 w-12 rounded-full transition-colors ${billing === 'anual' ? 'bg-primary' : 'bg-slate-200'}`}
          >
            <span
              className={`absolute top-1 h-5 w-5 rounded-full bg-white shadow-sm transition-all ${
                billing === 'anual' ? 'left-6' : 'left-1'
              }`}
            />
          </button>
          <span className={`text-sm font-medium ${billing === 'anual' ? 'text-charcoal' : 'text-charcoal-muted'}`}>
            Anual
          </span>
          <span className="rounded-full bg-mint-50 px-2.5 py-0.5 text-[11px] font-semibold text-mint-dark">
            Recomendado
          </span>
        </div>

        <div className="mt-10 grid gap-6 lg:grid-cols-3">
          {PAID_PLANS.map((plan, index) => {
            const price = landingPlanPriceView(plan, billing);
            return (
            <Reveal key={plan.id} from="left" delayMs={index * 90} className="h-full">
            <article
              className="flex h-full flex-col rounded-2xl border border-white/10 bg-charcoal p-6 shadow-[0_18px_50px_rgba(15,23,42,0.18)]"
            >
              <h3 className="font-serif text-2xl font-medium text-white">{plan.name}</h3>
              <p className="mt-1.5 text-sm text-white/65">{plan.tagline}</p>
              <div className="mt-6 flex items-baseline gap-2">
                {price.prefix ? (
                  <span className="text-lg font-semibold text-primary-200">{price.prefix}</span>
                ) : null}
                <span className="font-serif text-4xl font-medium tracking-tight text-white">
                  {price.amount}
                </span>
                {price.period ? <span className="text-sm text-white/55">{price.period}</span> : null}
              </div>
              <p className="mt-3 rounded-lg bg-white/10 px-3 py-2.5">
                <span className="block text-[11px] font-semibold uppercase tracking-[0.12em] text-white/70">
                  {plan.costPerPatientLabel}
                </span>
                <span className="mt-1 block font-serif text-2xl font-medium tracking-tight text-white sm:text-[1.75rem]">
                  {price.costPerPatientValue}
                </span>
              </p>
              <ul className="mt-5 flex-1 space-y-2.5">
                {plan.features.map((feature) => (
                  <li key={feature} className="flex items-start gap-2 text-[13px] leading-snug text-white/80">
                    <LandingIconMark icon="check" className="mt-0.5 h-4 w-4 shrink-0 text-primary-200" />
                    {feature}
                  </li>
                ))}
              </ul>
              <Link
                to="/register"
                className="mt-7 inline-flex h-12 w-full items-center justify-center rounded-xl bg-white px-5 text-sm font-semibold text-charcoal transition-all hover:bg-primary-50 active:scale-[0.98]"
              >
                {plan.cta}
                <ArrowRight className="ml-2 h-4 w-4" />
              </Link>
            </article>
            </Reveal>
            );
          })}
        </div>

        <Reveal from="left" className="mt-6">
        <div className="flex flex-col items-start justify-between gap-4 rounded-2xl border border-slate-100 bg-[#F8FAF9] px-6 py-5 sm:flex-row sm:items-center">
          <div>
            <h3 className="font-serif text-xl font-medium text-charcoal">{FREE_PLAN.name}</h3>
            <p className="mt-1 text-sm text-charcoal-muted">{FREE_PLAN.tagline}</p>
            <p className="mt-2 text-sm text-charcoal">{FREE_PLAN.features.join(' · ')}</p>
          </div>
          <Link
            to="/register"
            className="inline-flex h-11 shrink-0 items-center justify-center rounded-xl border border-slate-200 bg-white px-5 text-sm font-semibold text-charcoal transition-colors hover:border-primary/40 hover:bg-primary-50"
          >
            {FREE_PLAN.cta}
          </Link>
        </div>
        </Reveal>

        <p className="mt-8 text-center text-xs text-charcoal-muted">{PLANS_FOOTNOTE}</p>
      </div>
    </section>
  );
}

function FaqSection() {
  const [openIndex, setOpenIndex] = useState(0);

  return (
    <section id="faq" className="scroll-mt-16 bg-brand-mist px-4 py-20 sm:px-6">
      <div className="mx-auto max-w-6xl">
        <SectionHeading from="right" eyebrow="Dúvidas frequentes" title="Tudo o que você quer saber antes de começar." />
        <div className="mt-10 space-y-3">
          {FAQS.map((faq, index) => {
            const open = openIndex === index;
            return (
              <Reveal key={faq.question} from="right" delayMs={Math.min(index, 4) * 60}>
              <div
                className={`w-full overflow-hidden rounded-2xl transition-colors ${
                  open ? 'bg-charcoal' : 'border border-slate-200/80 bg-white'
                }`}
              >
                <button
                  type="button"
                  onClick={() => setOpenIndex(open ? -1 : index)}
                  aria-expanded={open}
                  className="flex w-full items-start justify-between gap-4 px-5 py-4 text-left"
                >
                  <span className={`font-display text-sm font-semibold ${open ? 'text-white' : 'text-charcoal'}`}>
                    {faq.question}
                  </span>
                  <span className={`mt-0.5 shrink-0 ${open ? 'text-white' : 'text-primary'}`}>
                    {open ? (
                      <svg className="h-5 w-5" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                        <path strokeLinecap="round" strokeLinejoin="round" d="M6 18L18 6M6 6l12 12" />
                      </svg>
                    ) : (
                      <svg className="h-5 w-5" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                        <path strokeLinecap="round" strokeLinejoin="round" d="M12 4.5v15m7.5-7.5h-15" />
                      </svg>
                    )}
                  </span>
                </button>
                {open && (
                  <p className="px-5 pb-5 text-sm leading-relaxed text-white/80">{faq.answer}</p>
                )}
              </div>
              </Reveal>
            );
          })}
        </div>
      </div>
    </section>
  );
}

function FinalCtaSection() {
  return (
    <section className="bg-brand-warm px-4 py-20 sm:px-6">
      <div className="landing-cta-banner mx-auto max-w-6xl rounded-[28px] bg-charcoal">
        <img
          src={ctaTerapia}
          alt=""
          className="landing-cta-photo"
          width={1600}
          height={900}
          decoding="async"
          loading="lazy"
        />
        <div className="landing-cta-fade" aria-hidden />
        <Reveal from="left" className="landing-cta-copy max-w-xl px-8 py-12 sm:px-12 sm:py-14 lg:px-16 lg:py-[4.25rem]">
          <p className="text-[11px] font-semibold uppercase tracking-[0.22em] text-slate-400">
            {FINAL_CTA.eyebrow}
          </p>
          <h2 className="mt-4 font-serif text-[1.85rem] font-medium leading-[1.15] tracking-tight text-white sm:text-4xl lg:text-[2.55rem]">
            {FINAL_CTA.titleLine1}
            <br />
            {FINAL_CTA.titleLine2}
          </h2>
          <p className="mt-5 max-w-[32rem] text-sm leading-relaxed text-white/80 sm:text-[15px]">
            {FINAL_CTA.body}
          </p>
          <div className="mt-8">
            <Link
              to="/register"
              className="inline-flex h-12 items-center justify-center rounded-full bg-white px-7 text-sm font-semibold text-charcoal shadow-sm transition-all hover:bg-slate-100 active:scale-[0.98]"
            >
              Começar teste gratuito
              <ArrowRight className="ml-2 h-4 w-4" />
            </Link>
          </div>
          <ul className="mt-8 flex flex-wrap gap-x-6 gap-y-2 text-[12px] text-slate-400">
            {FINAL_CTA.markers.map((marker) => (
              <li key={marker.label} className="flex items-center gap-1.5">
                <LandingIconMark icon={marker.icon} className="h-3.5 w-3.5 text-slate-400" />
                {marker.label}
              </li>
            ))}
          </ul>
        </Reveal>
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
            Contrato de Adesão
          </button>
          <button
            type="button"
            onClick={onOpenTerms}
            className="text-sm font-medium text-charcoal underline decoration-charcoal/20 underline-offset-4 transition-colors hover:text-primary"
          >
            Política de Privacidade
          </button>
          <Link
            to={HELP_LINK.to}
            className="text-sm font-medium text-charcoal underline decoration-charcoal/20 underline-offset-4 transition-colors hover:text-primary"
          >
            {HELP_LINK.label}
          </Link>
        </nav>
      </div>

      <div className="mx-auto mt-10 max-w-6xl border-t border-slate-100 pt-6 text-center">
        <p className="text-xs text-charcoal-muted/60">
          {LEGAL_ENTITY.legalName} · CNPJ {LEGAL_ENTITY.cnpj}
        </p>
        <p className="mt-1.5 text-xs text-charcoal-muted/60">
          Unithery © 2026 — Inteligência Artificial Aplicada ao Desenvolvimento Humano. Em conformidade com a LGPD.
        </p>
      </div>
    </footer>
  );
}

export default function LandingPageContainer() {
  const navigate = useNavigate();
  const [termsOpen, setTermsOpen] = useState(false);

  return (
    <div className="min-h-dvh bg-white font-sans">
      <Header />
      <main>
        <HeroSection />
        <StepsSection />
        <FeaturesSection />
        <WhySection />
        <TestimonialsSection />
        <PlansSection />
        <FaqSection />
        <PillarsSection />
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
