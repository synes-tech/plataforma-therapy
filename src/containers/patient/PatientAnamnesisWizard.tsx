import { useState, useEffect, useCallback } from 'react';
import {
  ACOMPANHAMENTO_OPTIONS,
  EMPTY_ANAMNESIS_FORM,
  WIZARD_STEPS,
  type PatientAnamnesisForm,
} from './patient-anamnesis.types';
import { canAdvanceFromStep, validateAnamnesisStep } from './patient-anamnesis.validation';
import { PatientPhotoUpload } from './PatientPhotoUpload';

interface PatientAnamnesisWizardProps {
  formId: string;
  onSubmit: (form: PatientAnamnesisForm, avatarFile: File | null) => void;
  isSubmitting?: boolean;
}

const inputClass =
  'h-11 w-full rounded-xl border border-white/10 bg-white/5 px-4 text-sm text-slate-100 placeholder:text-slate-500 transition-all focus:border-primary/60 focus:outline-none focus:ring-[3px] focus:ring-primary/20';

const textareaClass =
  'w-full rounded-xl border border-white/10 bg-white/5 px-4 py-3 text-sm text-slate-100 placeholder:text-slate-500 transition-all focus:border-primary/60 focus:outline-none focus:ring-[3px] focus:ring-primary/20';

export function PatientAnamnesisWizard({ formId, onSubmit, isSubmitting }: PatientAnamnesisWizardProps) {
  const [step, setStep] = useState(1);
  const [form, setForm] = useState<PatientAnamnesisForm>(EMPTY_ANAMNESIS_FORM);
  const [errors, setErrors] = useState<Record<string, string>>({});
  const [avatarFile, setAvatarFile] = useState<File | null>(null);
  const [avatarPreview, setAvatarPreview] = useState<string | null>(null);
  const [avatarError, setAvatarError] = useState<string | null>(null);

  useEffect(() => {
    return () => {
      if (avatarPreview) URL.revokeObjectURL(avatarPreview);
    };
  }, [avatarPreview]);

  const handleAvatarSelected = useCallback((file: File) => {
    setAvatarFile(file);
    setAvatarPreview((prev) => {
      if (prev) URL.revokeObjectURL(prev);
      return URL.createObjectURL(file);
    });
    setAvatarError(null);
  }, []);

  function patch<K extends keyof PatientAnamnesisForm>(key: K, value: PatientAnamnesisForm[K]) {
    setForm((f) => ({ ...f, [key]: value }));
    setErrors((e) => {
      const next = { ...e };
      delete next[key];
      return next;
    });
  }

  function toggleAcompanhamento(option: string) {
    setForm((f) => {
      const has = f.acompanhamento_multi.includes(option);
      return {
        ...f,
        acompanhamento_multi: has
          ? f.acompanhamento_multi.filter((x) => x !== option)
          : [...f.acompanhamento_multi, option],
      };
    });
  }

  function goNext() {
    const result = validateAnamnesisStep(step, form);
    if (!result.valid) {
      setErrors(result.errors);
      return;
    }
    setErrors({});
    setStep((s) => Math.min(4, s + 1));
  }

  function goBack() {
    setErrors({});
    setStep((s) => Math.max(1, s - 1));
  }

  function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    const result = validateAnamnesisStep(1, form);
    if (!result.valid) {
      setErrors(result.errors);
      setStep(1);
      return;
    }
    onSubmit(form, avatarFile);
  }

  return (
    <form id={formId} onSubmit={handleSubmit} className="space-y-5">
      {/* Step indicator */}
      <nav aria-label="Etapas da anamnese" className="flex gap-1 overflow-x-auto pb-1">
        {WIZARD_STEPS.map((s) => {
          const active = s.id === step;
          const done = s.id < step;
          return (
            <div
              key={s.id}
              className={`shrink-0 rounded-full px-3 py-1 text-xs font-medium transition-colors ${
                active
                  ? 'bg-primary/30 text-primary-100 ring-1 ring-primary/40'
                  : done
                    ? 'bg-white/10 text-slate-300'
                    : 'bg-white/5 text-slate-500'
              }`}
            >
              {s.id}. {s.label}
            </div>
          );
        })}
      </nav>

      <div className="rounded-2xl border border-white/10 bg-gradient-to-br from-slate-900/95 via-slate-900 to-slate-800/90 p-5 shadow-inner backdrop-blur-xl">
        {step === 1 && (
          <div className="space-y-5">
            <div className="flex justify-center border-b border-white/10 pb-5 md:justify-start">
              <PatientPhotoUpload
                name={form.name}
                variant="wizard"
                previewUrl={avatarPreview}
                disabled={isSubmitting}
                onFileSelected={handleAvatarSelected}
                onValidationError={setAvatarError}
              />
            </div>
            {avatarError && (
              <p className="text-center text-xs text-red-400 md:text-left" role="alert">{avatarError}</p>
            )}
            <div className="grid grid-cols-1 gap-4 md:grid-cols-2">
            <Field label="Nome completo *" error={errors.name}>
              <input className={inputClass} value={form.name} onChange={(e) => patch('name', e.target.value)} placeholder="Nome do paciente" />
            </Field>
            <Field label="Nome social" error={errors.nome_social}>
              <input className={inputClass} value={form.nome_social} onChange={(e) => patch('nome_social', e.target.value)} placeholder="Se aplicável" />
            </Field>
            <Field label="Data de nascimento *" error={errors.birth_date}>
              <input type="date" className={inputClass} value={form.birth_date} onChange={(e) => patch('birth_date', e.target.value)} />
            </Field>
            <Field label="Escolaridade / ocupação">
              <input className={inputClass} value={form.escolaridade_ocupacao} onChange={(e) => patch('escolaridade_ocupacao', e.target.value)} placeholder="Ex.: 3º ano EF, estudante" />
            </Field>
            <div className="md:col-span-2">
              <Field label="Diagnósticos * (separados por vírgula)" error={errors.diagnoses}>
                <input className={inputClass} value={form.diagnoses} onChange={(e) => patch('diagnoses', e.target.value)} placeholder="TEA Nível 1, TDAH" />
              </Field>
            </div>
            </div>
          </div>
        )}

        {step === 2 && (
          <div className="space-y-4">
            <Field label="Queixa principal">
              <textarea className={textareaClass} rows={3} value={form.queixa_principal} onChange={(e) => patch('queixa_principal', e.target.value)} placeholder="Motivo principal do acompanhamento..." />
            </Field>
            <Field label="Medicamentos em uso">
              <textarea className={textareaClass} rows={2} value={form.medicamentos} onChange={(e) => patch('medicamentos', e.target.value)} placeholder="Nome, dose e horário (se souber)" />
            </Field>
            <div>
              <p className="mb-2 text-sm font-medium text-slate-200">Acompanhamento multidisciplinar</p>
              <div className="flex flex-wrap gap-2">
                {ACOMPANHAMENTO_OPTIONS.map((opt) => {
                  const selected = form.acompanhamento_multi.includes(opt);
                  return (
                    <button
                      key={opt}
                      type="button"
                      onClick={() => toggleAcompanhamento(opt)}
                      className={`rounded-full px-3 py-1.5 text-xs font-medium transition-all ${
                        selected
                          ? 'bg-primary/40 text-white ring-1 ring-primary/50'
                          : 'bg-white/5 text-slate-400 hover:bg-white/10 hover:text-slate-200'
                      }`}
                    >
                      {opt}
                    </button>
                  );
                })}
              </div>
            </div>
            <Field label="Observações clínicas iniciais">
              <textarea className={textareaClass} rows={2} value={form.clinical_observations} onChange={(e) => patch('clinical_observations', e.target.value)} />
            </Field>
          </div>
        )}

        {step === 3 && (
          <div className="space-y-4">
            <Field label="Composição familiar">
              <textarea className={textareaClass} rows={3} value={form.composicao_familiar} onChange={(e) => patch('composicao_familiar', e.target.value)} placeholder="Quem mora com o paciente, vínculos..." />
            </Field>
            <Field label="Responsáveis pelo acompanhamento">
              <textarea className={textareaClass} rows={2} value={form.responsaveis} onChange={(e) => patch('responsaveis', e.target.value)} placeholder="Nomes e contato dos cuidadores principais" />
            </Field>
          </div>
        )}

        {step === 4 && (
          <div className="space-y-4">
            <Field label="Objetivos terapêuticos">
              <textarea className={textareaClass} rows={3} value={form.objetivos_terapeuticos} onChange={(e) => patch('objetivos_terapeuticos', e.target.value)} placeholder="Metas declaradas pela família e pelo terapeuta..." />
            </Field>
            <Field label="Hiperfocos e interesses (engajamento IA)">
              <textarea className={textareaClass} rows={2} value={form.hiperfocos_interesses} onChange={(e) => patch('hiperfocos_interesses', e.target.value)} placeholder="Dinossauros, Minecraft, música, rotinas preferidas..." />
            </Field>
            <Field label="Informações adicionais (opcional)">
              <textarea
                className={`${textareaClass} min-h-[140px]`}
                rows={6}
                value={form.informacoes_adicionais}
                onChange={(e) => patch('informacoes_adicionais', e.target.value)}
                placeholder="Qualquer contexto relevante para personalizar o copiloto de IA..."
              />
            </Field>
          </div>
        )}
      </div>

      {/* Wizard navigation (inside form — footer do modal chama submit no passo 4) */}
      <div className="flex flex-col-reverse gap-2 sm:flex-row sm:justify-between">
        <button
          type="button"
          onClick={goBack}
          disabled={step === 1 || isSubmitting}
          className="inline-flex h-11 items-center justify-center rounded-xl border border-slate-200 px-5 text-sm font-medium text-charcoal-muted transition-colors hover:bg-slate-100 disabled:opacity-40"
        >
          Voltar
        </button>
        {step < 4 ? (
          <button
            type="button"
            onClick={goNext}
            disabled={!canAdvanceFromStep(step, form)}
            className="inline-flex h-11 items-center justify-center rounded-xl bg-primary px-6 text-sm font-medium text-white shadow-sm transition-all hover:bg-primary-dark disabled:opacity-50"
          >
            Avançar
          </button>
        ) : null}
      </div>
    </form>
  );
}

function Field({ label, error, children }: { label: string; error?: string; children: React.ReactNode }) {
  return (
    <div>
      <label className="mb-1.5 block text-sm font-medium text-slate-200">{label}</label>
      {children}
      {error && <p className="mt-1 text-xs text-red-400" role="alert">{error}</p>}
    </div>
  );
}
