import { useEffect, useMemo, useState, type ReactNode } from 'react';
import { FINANCE_DEMO, SHOWCASE_DEMO } from './landing-content';
import { LandingIconMark } from './landing-icons';
import {
  filterFinanceDemoItems,
  financeDemoKpis,
  formatFinanceDemoCurrency,
  registerFinanceDemoPayment,
  toggleFinanceDemoFilter,
  type FinanceDemoFilter,
} from './landing-finance.utils';
import { nextDemoStep } from './landing-showcase.utils';
import './landing-showcase.css';

function useDemoCycle(count: number, intervalMs: number) {
  const [step, setStep] = useState(0);
  const [paused, setPaused] = useState(false);

  useEffect(() => {
    if (paused || count <= 1) return;
    if (window.matchMedia('(prefers-reduced-motion: reduce)').matches) return;

    const timer = window.setInterval(() => {
      setStep((current) => nextDemoStep(current, count));
    }, intervalMs);

    return () => window.clearInterval(timer);
  }, [count, intervalMs, paused]);

  return {
    step,
    paused,
    setPaused,
    select(next: number) {
      setPaused(true);
      setStep(next);
    },
    advance() {
      setPaused(true);
      setStep((current) => nextDemoStep(current, count));
    },
  };
}

function ShowcaseWindow({
  title,
  badge,
  onPauseChange,
  children,
}: {
  title: string;
  badge?: string;
  onPauseChange: (paused: boolean) => void;
  children: ReactNode;
}) {
  return (
    <div
      className="landing-show-window"
      onPointerEnter={() => onPauseChange(true)}
      onPointerLeave={() => onPauseChange(false)}
    >
      <div className="landing-show-chrome">
        <span className="landing-show-dots" aria-hidden>
          <i />
          <i />
          <i />
        </span>
        <span className="landing-show-chrome-title">{title}</span>
        {badge ? <span className="landing-show-chrome-badge">{badge}</span> : null}
      </div>
      <div className="landing-show-body">{children}</div>
    </div>
  );
}

export function ShowcasePanel({ id }: { id: string }) {
  switch (id) {
    case 'diario':
      return <DiarioPanel />;
    case 'anexos':
      return <AnexosPanel />;
    case 'copiloto-chat':
      return <CopilotoPanel />;
    case 'ditado':
      return <DitadoPanel />;
    case 'agenda':
      return <AgendaPanel />;
    case 'relatorios':
      return <RelatoriosPanel />;
    case 'financeiro':
      return <FinanceiroPanel />;
    case 'portal-familia':
      return <PortalPanel />;
    default:
      return null;
  }
}

function DiarioPanel() {
  const { days, window: title } = SHOWCASE_DEMO.diario;
  const { step, select, setPaused } = useDemoCycle(days.length, 2600);
  const active = days[step] ?? days[0]!;

  return (
    <ShowcaseWindow title={title} badge="Registro da família" onPauseChange={setPaused}>
      <div className="landing-show-week">
        {days.map((day, index) => (
          <button
            key={day.day}
            type="button"
            onClick={() => select(index)}
            aria-pressed={index === step}
            className={`landing-show-day${index === step ? ' is-on' : ''}`}
          >
            {day.day}
          </button>
        ))}
      </div>

      <ul className="mt-4 space-y-2.5">
        {active.entries.map((entry) => (
          <li key={entry.label} className={`landing-show-entry is-${entry.tone}`}>
            <span className="landing-show-entry-dot" aria-hidden />
            <span className="min-w-0">
              <span className="block text-[13px] font-semibold text-charcoal">{entry.label}</span>
              <span className="block text-xs text-charcoal-muted">{entry.detail}</span>
            </span>
          </li>
        ))}
      </ul>

      <p className="landing-show-ai-note">
        <LandingIconMark icon="sparkle" className="h-3.5 w-3.5 shrink-0" />
        {active.summary}
      </p>
    </ShowcaseWindow>
  );
}

function AnexosPanel() {
  const { files, window: title } = SHOWCASE_DEMO.anexos;
  const { step, select, setPaused } = useDemoCycle(files.length, 3200);
  const active = files[step] ?? files[0]!;

  return (
    <ShowcaseWindow title={title} badge="Leitura automática" onPauseChange={setPaused}>
      <ul className="space-y-2">
        {files.map((file, index) => (
          <li key={file.name}>
            <button
              type="button"
              onClick={() => select(index)}
              aria-pressed={index === step}
              className={`landing-show-file${index === step ? ' is-on' : ''}`}
            >
              <LandingIconMark icon="file" className="h-4 w-4 shrink-0 text-primary" />
              <span className="min-w-0 flex-1 text-left">
                <span className="block truncate text-[13px] font-semibold text-charcoal">{file.name}</span>
                <span className="block truncate text-[11px] text-charcoal-muted">{file.meta}</span>
              </span>
              {index === step ? <span className="landing-show-scanbar" aria-hidden /> : null}
            </button>
          </li>
        ))}
      </ul>

      <p className="landing-show-label">Extraído pela IA</p>
      <ul className="flex flex-wrap gap-1.5">
        {active.insights.map((insight, index) => (
          <li
            key={insight}
            className="landing-show-chip"
            style={{ animationDelay: `${index * 140}ms` }}
          >
            {insight}
          </li>
        ))}
      </ul>
    </ShowcaseWindow>
  );
}

function CopilotoPanel() {
  const { threads, window: title } = SHOWCASE_DEMO.copiloto;
  const { step, select, setPaused } = useDemoCycle(threads.length, 3600);
  const active = threads[step] ?? threads[0]!;
  const [typing, setTyping] = useState(true);

  useEffect(() => {
    setTyping(true);
    const timer = window.setTimeout(() => setTyping(false), 900);
    return () => window.clearTimeout(timer);
  }, [step]);

  return (
    <ShowcaseWindow title={title} badge="Contexto isolado" onPauseChange={setPaused}>
      <div className="flex min-h-[9.5rem] flex-col gap-2">
        <p className="landing-show-bubble is-user">{active.question}</p>
        <div className="landing-show-bubble is-ai">
          {typing ? (
            <span className="landing-show-typing" aria-label="Copiloto respondendo">
              <i />
              <i />
              <i />
            </span>
          ) : (
            <>
              <span className="landing-show-bubble-tag">{active.tag}</span>
              {active.answer}
            </>
          )}
        </div>
      </div>

      <p className="landing-show-label">Perguntas rápidas</p>
      <div className="flex flex-wrap gap-1.5">
        {threads.map((thread, index) => (
          <button
            key={thread.question}
            type="button"
            onClick={() => select(index)}
            aria-pressed={index === step}
            className={`landing-show-suggest${index === step ? ' is-on' : ''}`}
          >
            {thread.question}
          </button>
        ))}
      </div>
    </ShowcaseWindow>
  );
}

const WAVE = [34, 58, 44, 82, 52, 70, 40, 88, 56, 38, 74, 50, 66, 42, 80, 48];

function DitadoPanel() {
  const copy = SHOWCASE_DEMO.ditado;
  const { step, advance, setPaused } = useDemoCycle(copy.lines.length + 2, 1400);
  const recording = step < copy.lines.length + 1;
  const visibleLines = Math.min(step, copy.lines.length);

  return (
    <ShowcaseWindow title={copy.window} badge={recording ? 'Gravando' : 'Rascunho pronto'} onPauseChange={setPaused}>
      <div className="flex items-center gap-3">
        <button
          type="button"
          onClick={advance}
          className={`landing-show-mic${recording ? ' is-live' : ''}`}
          aria-label={recording ? 'Encerrar o ditado' : 'Recomeçar o ditado'}
        >
          <LandingIconMark icon="mic" className="h-5 w-5 text-white" />
        </button>
        <span className="flex h-10 flex-1 items-center gap-[3px]">
          {WAVE.map((height, index) => (
            <span
              key={index}
              className={`landing-show-wave${recording ? ' is-live' : ''}`}
              style={{ height: `${height}%`, animationDelay: `${index * 60}ms` }}
            />
          ))}
        </span>
        <span className="text-xs font-semibold text-primary">{copy.time}</span>
      </div>

      <ul className="mt-4 space-y-1.5">
        {copy.lines.slice(0, visibleLines).map((line) => (
          <li key={line} className="landing-show-transcript">
            {line}
          </li>
        ))}
      </ul>

      <div className={`landing-show-note${recording ? '' : ' is-on'}`}>
        <p className="landing-show-label mt-0">Evolução estruturada</p>
        <p className="text-xs leading-relaxed text-charcoal">
          <span className="font-semibold">S:</span> {copy.note.subjective}
        </p>
        <p className="mt-1 text-xs leading-relaxed text-charcoal">
          <span className="font-semibold">P:</span> {copy.note.plan}
        </p>
      </div>
    </ShowcaseWindow>
  );
}

function AgendaPanel() {
  const copy = SHOWCASE_DEMO.agenda;
  const { step, select, setPaused } = useDemoCycle(copy.slots.length, 2400);
  const active = copy.slots[step] ?? copy.slots[0]!;

  return (
    <ShowcaseWindow title={copy.window} badge="Semana atual" onPauseChange={setPaused}>
      <div className="landing-show-grid">
        {copy.days.map((day) => (
          <span key={day} className="landing-show-grid-head">
            {day}
          </span>
        ))}
        {copy.days.map((day, dayIndex) => {
          const slotIndex = copy.slots.findIndex((slot) => slot.day === dayIndex);
          const slot = copy.slots[slotIndex];
          return (
            <span key={`col-${day}`} className="landing-show-grid-col">
              {slot ? (
                <button
                  type="button"
                  onClick={() => select(slotIndex)}
                  aria-pressed={slotIndex === step}
                  className={`landing-show-slot${slotIndex === step ? ' is-on' : ''}`}
                  style={{ marginTop: `${dayIndex * 9}px` }}
                >
                  <span className="block text-[10px] font-bold">{slot.time}</span>
                  <span className="block truncate text-[10px] opacity-80">{slot.patient}</span>
                </button>
              ) : null}
            </span>
          );
        })}
      </div>

      <div className="landing-show-slot-detail">
        <span>
          <p className="text-[13px] font-semibold text-charcoal">
            {active.patient} · {active.time}
          </p>
          <p className="text-[11px] text-charcoal-muted">Sessão de 60 min · presencial</p>
        </span>
        <span className="landing-show-pill is-on">
          <LandingIconMark icon="check" className="h-3 w-3" />
          {copy.reminder}
        </span>
      </div>
    </ShowcaseWindow>
  );
}

function RelatoriosPanel() {
  const copy = SHOWCASE_DEMO.relatorios;
  const [sections, setSections] = useState(copy.sections);
  const [sent, setSent] = useState(false);
  const [paused, setPaused] = useState(false);

  useEffect(() => {
    if (paused) return;
    if (window.matchMedia('(prefers-reduced-motion: reduce)').matches) return;

    const timer = window.setInterval(() => setSent((current) => !current), 3000);
    return () => window.clearInterval(timer);
  }, [paused]);

  function toggle(label: string) {
    setPaused(true);
    setSections((current) =>
      current.map((section) => (section.label === label ? { ...section, shared: !section.shared } : section)),
    );
  }

  const sharedCount = sections.filter((section) => section.shared).length;

  return (
    <ShowcaseWindow title={copy.window} badge={`${sharedCount} de ${sections.length} compartilhados`} onPauseChange={setPaused}>
      <div className="landing-show-sheet">
        <p className="font-serif text-sm text-charcoal">{copy.title}</p>
        <ul className="mt-2.5 space-y-1.5">
          {sections.map((section) => (
            <li key={section.label}>
              <button
                type="button"
                onClick={() => toggle(section.label)}
                aria-pressed={section.shared}
                className={`landing-show-share${section.shared ? ' is-on' : ''}`}
              >
                <span className="landing-show-switch" aria-hidden />
                <span className="min-w-0 flex-1 truncate text-left text-[12px] font-medium">
                  {section.label}
                </span>
                <span className="text-[10px] font-semibold uppercase tracking-wide">
                  {section.shared ? 'Família' : 'Interno'}
                </span>
              </button>
            </li>
          ))}
        </ul>
      </div>

      <span className={`landing-show-pill${sent ? ' is-on' : ''}`}>
        <LandingIconMark icon={sent ? 'check' : 'file'} className="h-3 w-3" />
        {sent ? copy.sent : 'Gerando PDF…'}
      </span>
    </ShowcaseWindow>
  );
}

function MoodFace({ tone }: { tone: 'ok' | 'warn' | 'alert' }) {
  const mouth =
    tone === 'ok' ? 'M8.5 14.5c1 1.4 2.1 2 3.5 2s2.5-.6 3.5-2' : tone === 'warn' ? 'M8.5 15h7' : 'M8.5 16.5c1-1.4 2.1-2 3.5-2s2.5.6 3.5 2';

  return (
    <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={1.7} className="h-5 w-5" aria-hidden>
      <circle cx="12" cy="12" r="9" />
      <path strokeLinecap="round" d="M9 9.8h.01M15 9.8h.01" />
      <path strokeLinecap="round" d={mouth} />
    </svg>
  );
}

const CHECKIN_STEPS = 6;

function PortalPanel() {
  const copy = SHOWCASE_DEMO.portal;
  const { step, setPaused, select } = useDemoCycle(CHECKIN_STEPS, 1500);
  const [mood, setMood] = useState<number | null>(null);
  const [humor, setHumor] = useState<number | null>(null);
  const [crisis, setCrisis] = useState<boolean | null>(null);
  const [audio, setAudio] = useState<'idle' | 'recording' | 'done'>('idle');

  useEffect(() => {
    setMood(step >= 1 ? 2 : null);
    setHumor(step >= 2 ? 2 : null);
    setCrisis(step >= 3 ? true : null);
    setAudio(step >= 5 ? 'done' : step === 4 ? 'recording' : 'idle');
  }, [step]);

  function pause() {
    setPaused(true);
  }

  return (
    <ShowcaseWindow
      title={copy.window}
      badge={audio === 'done' ? 'Enviado' : 'No celular da família'}
      onPauseChange={setPaused}
    >
      <p className="text-[13px] font-semibold text-charcoal">{copy.question}</p>

      <div className="mt-3 grid grid-cols-3 gap-2">
        {copy.moods.map((option, index) => (
          <button
            key={option.id}
            type="button"
            onClick={() => {
              pause();
              setMood(index);
            }}
            aria-pressed={mood === index}
            className={`landing-show-mood is-${option.tone}${mood === index ? ' is-on' : ''}`}
          >
            <MoodFace tone={option.tone} />
            <span className="mt-1 block text-[11px] font-semibold">{option.label}</span>
          </button>
        ))}
      </div>

      <p className="landing-show-label">{copy.humorLabel}</p>
      <div className="flex flex-wrap gap-1.5">
        {copy.humors.map((option, index) => (
          <button
            key={option}
            type="button"
            onClick={() => {
              pause();
              setHumor(index);
            }}
            aria-pressed={humor === index}
            className={`landing-show-suggest${humor === index ? ' is-on' : ''}`}
          >
            {option}
          </button>
        ))}
      </div>

      <div className="mt-4 flex items-center justify-between gap-3">
        <span className="text-[12px] font-semibold text-charcoal">{copy.crisisLabel}</span>
        <span className="landing-show-seg">
          <button
            type="button"
            onClick={() => {
              pause();
              setCrisis(false);
            }}
            aria-pressed={crisis === false}
            className={crisis === false ? 'is-on' : ''}
          >
            Não
          </button>
          <button
            type="button"
            onClick={() => {
              pause();
              setCrisis(true);
            }}
            aria-pressed={crisis === true}
            className={crisis === true ? 'is-on is-alert' : ''}
          >
            Sim
          </button>
        </span>
      </div>

      {crisis ? <p className="landing-show-crisis">{copy.crisisDetail}</p> : null}

      <div className="landing-show-audio">
        <button
          type="button"
          onClick={() => {
            pause();
            setAudio((current) => (current === 'recording' ? 'done' : 'recording'));
          }}
          className={`landing-show-mic is-small${audio === 'recording' ? ' is-live' : ''}`}
          aria-label={audio === 'recording' ? 'Encerrar o áudio do check-in' : 'Gravar o check-in por áudio'}
        >
          <LandingIconMark icon="mic" className="h-4 w-4 text-white" />
        </button>
        <span className="min-w-0 flex-1">
          {audio === 'idle' ? (
            <span className="block text-[11px] font-medium text-charcoal-muted">{copy.audio.hint}</span>
          ) : (
            <span className="flex h-6 items-center gap-[3px]">
              {WAVE.slice(0, 12).map((height, index) => (
                <span
                  key={index}
                  className={`landing-show-wave${audio === 'recording' ? ' is-live' : ''}`}
                  style={{ height: `${height}%`, animationDelay: `${index * 70}ms` }}
                />
              ))}
            </span>
          )}
        </span>
        <span className="text-[11px] font-semibold text-primary">{copy.audio.duration}</span>
      </div>

      {audio === 'done' ? (
        <div className="landing-show-bubble is-ai mt-2 max-w-full">
          <span className="landing-show-bubble-tag">Áudio transcrito pela IA</span>
          {copy.audio.transcript}
        </div>
      ) : null}

      <button
        type="button"
        onClick={() => {
          pause();
          select(audio === 'done' ? 0 : CHECKIN_STEPS - 1);
        }}
        className={`landing-show-pill mt-3${audio === 'done' ? ' is-on' : ''}`}
      >
        <LandingIconMark icon={audio === 'done' ? 'check' : 'sync'} className="h-3 w-3" />
        {audio === 'done' ? copy.sent : 'Enviar check-in do dia'}
      </button>
    </ShowcaseWindow>
  );
}

function FinanceiroPanel() {
  const [items, setItems] = useState(FINANCE_DEMO.items);
  const [filter, setFilter] = useState<FinanceDemoFilter>('all');
  const [, setPaused] = useState(false);

  const visible = useMemo(() => filterFinanceDemoItems(items, filter), [items, filter]);
  const kpis = useMemo(() => financeDemoKpis(items), [items]);
  const max = Math.max(...FINANCE_DEMO.trend.map((point) => point.percent));

  return (
    <ShowcaseWindow title={FINANCE_DEMO.window} badge={FINANCE_DEMO.monthLabel} onPauseChange={setPaused}>
      <div className="grid grid-cols-3 gap-2">
        <FinanceKpi
          label="Recebido"
          value={formatFinanceDemoCurrency(kpis.realizadaCents)}
          hint={`${kpis.paidCount} honorários`}
          tone="mint"
          active={filter === 'PAGO'}
          onClick={() => setFilter((current) => toggleFinanceDemoFilter(current, 'PAGO'))}
        />
        <FinanceKpi
          label="A receber"
          value={formatFinanceDemoCurrency(kpis.aReceberCents)}
          hint={`${kpis.pendingCount} abertos`}
          tone="alert"
          active={filter === 'PENDENTE'}
          onClick={() => setFilter((current) => toggleFinanceDemoFilter(current, 'PENDENTE'))}
        />
        <FinanceKpi
          label="Atrasado"
          value={formatFinanceDemoCurrency(kpis.atrasadoCents)}
          hint={`${kpis.overdueCount} vencido${kpis.overdueCount === 1 ? '' : 's'}`}
          tone="error"
          active={filter === 'ATRASADO'}
          onClick={() => setFilter((current) => toggleFinanceDemoFilter(current, 'ATRASADO'))}
        />
      </div>

      <div className="mt-4 flex items-end gap-3">
        <span className="flex h-14 flex-1 items-end gap-1.5">
          {FINANCE_DEMO.trend.map((point, index) => (
            <span key={point.label} className="flex min-w-0 flex-1 flex-col items-center gap-1">
              <span className="flex h-11 w-full items-end justify-center">
                <span
                  className="landing-show-bar"
                  style={{ height: `${(point.percent / max) * 100}%`, animationDelay: `${index * 90}ms` }}
                />
              </span>
              <span className="text-[9px] font-semibold uppercase text-charcoal-muted">{point.label}</span>
            </span>
          ))}
        </span>
        <span className="text-right">
          <span className="block text-[10px] font-semibold uppercase tracking-wide text-charcoal-muted">
            Recebido
          </span>
          <span className="block font-serif text-xl text-charcoal">{kpis.receivedPercent}%</span>
        </span>
      </div>

      <ul className="mt-3 divide-y divide-slate-100" aria-label="Honorários do mês">
        {visible.slice(0, 3).map((item) => (
          <li key={item.id} className="flex items-center gap-3 py-2">
            <span className="min-w-0 flex-1">
              <span className="block truncate text-[12px] font-semibold text-charcoal">{item.patient}</span>
              <span className="block text-[10px] text-charcoal-muted">
                {item.plan} · vence {item.due}
              </span>
            </span>
            <span className="text-right">
              <span className="block text-[12px] font-semibold tabular-nums text-charcoal">
                {formatFinanceDemoCurrency(item.amountCents)}
              </span>
              <span className={`landing-show-status is-${item.status.toLowerCase()}`}>
                {item.status === 'PAGO' ? 'Recebido' : item.status === 'PENDENTE' ? 'A receber' : 'Atrasado'}
              </span>
            </span>
            {item.status === 'PAGO' ? (
              <span className="inline-flex h-7 w-[4.4rem] items-center justify-center text-mint-dark" aria-hidden>
                <LandingIconMark icon="check" className="h-4 w-4" />
              </span>
            ) : (
              <button
                type="button"
                className="landing-show-pay"
                onClick={() => {
                  setPaused(true);
                  setItems((current) => registerFinanceDemoPayment(current, item.id));
                }}
                aria-label={`Registrar honorário de ${item.patient}`}
              >
                Registrar
              </button>
            )}
          </li>
        ))}
      </ul>
    </ShowcaseWindow>
  );
}

function FinanceKpi({
  label,
  value,
  hint,
  tone,
  active,
  onClick,
}: {
  label: string;
  value: string;
  hint: string;
  tone: 'mint' | 'alert' | 'error';
  active: boolean;
  onClick: () => void;
}) {
  return (
    <button type="button" onClick={onClick} aria-pressed={active} className={`landing-show-kpi is-${tone}${active ? ' is-active' : ''}`}>
      <span className="block text-[9px] font-bold uppercase tracking-[0.12em] text-charcoal-muted">{label}</span>
      <span className="mt-0.5 block font-serif text-[15px] text-charcoal">{value}</span>
      <span className="block text-[10px] text-charcoal-muted">{hint}</span>
    </button>
  );
}
