import {
  forwardRef,
  useCallback,
  useEffect,
  useImperativeHandle,
  useState,
} from 'react';
import {
  CONTACT_SCOPE_OPTIONS,
  EMPTY_ANAMNESIS_FORM,
  WIZARD_STEPS,
  type PatientAnamnesisForm,
  type PatientContactScope,
} from './patient-anamnesis.types';
import { canAdvanceFromStep, validateAnamnesisStep } from './patient-anamnesis.validation';
import { PatientPhotoUpload } from './PatientPhotoUpload';
import { AcompanhamentoMultiField } from './AcompanhamentoMultiField';
import { PatientAttachmentDropzone } from './attachments/PatientAttachmentDropzone';
import { formatAttachmentSize } from './attachments/patient-attachment.utils';
import { PhoneInput } from '@features/register/PhoneInput';

const TOTAL_STEPS = WIZARD_STEPS.length;

export interface PatientAnamnesisWizardHandle {
  goNext: () => boolean;
  goBack: () => void;
  getStep: () => number;
  canAdvance: () => boolean;
}

interface PatientAnamnesisWizardProps {
  formId: string;
  onSubmit: (form: PatientAnamnesisForm, avatarFile: File | null, attachmentFiles: File[]) => void;
  isSubmitting?: boolean;
  onStepChange?: (step: number) => void;
  onCanAdvanceChange?: (canAdvance: boolean) => void;
}

const inputClass =
  'h-11 w-full rounded-xl border border-slate-200 bg-white px-4 text-sm text-charcoal placeholder:text-charcoal-muted/40 transition-all focus:border-primary/50 focus:outline-none focus:ring-[3px] focus:ring-primary/10';

const textareaClass =
  'w-full resize-y rounded-xl border border-slate-200 bg-white px-4 py-3 text-sm text-charcoal placeholder:text-charcoal-muted/40 transition-all focus:border-primary/50 focus:outline-none focus:ring-[3px] focus:ring-primary/10';

export const PatientAnamnesisWizard = forwardRef<
  PatientAnamnesisWizardHandle,
  PatientAnamnesisWizardProps
>(function PatientAnamnesisWizard(
  { formId, onSubmit, isSubmitting, onStepChange, onCanAdvanceChange },
  ref,
) {
  const [step, setStep] = useState(1);
  const [form, setForm] = useState<PatientAnamnesisForm>(EMPTY_ANAMNESIS_FORM);
  const [errors, setErrors] = useState<Record<string, string>>({});
  const [avatarFile, setAvatarFile] = useState<File | null>(null);
  const [avatarPreview, setAvatarPreview] = useState<string | null>(null);
  const [avatarError, setAvatarError] = useState<string | null>(null);
  const [attachmentFiles, setAttachmentFiles] = useState<File[]>([]);

  useEffect(() => {
    onStepChange?.(step);
  }, [step, onStepChange]);

  useEffect(() => {
    onCanAdvanceChange?.(canAdvanceFromStep(step, form));
  }, [step, form, onCanAdvanceChange]);

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

  function goNext() {
    const result = validateAnamnesisStep(step, form);
    if (!result.valid) {
      setErrors(result.errors);
      return false;
    }
    setErrors({});
    setStep((s) => Math.min(TOTAL_STEPS, s + 1));
    return true;
  }

  function goBack() {
    setErrors({});
    setStep((s) => Math.max(1, s - 1));
  }

  useImperativeHandle(
    ref,
    () => ({
      goNext,
      goBack,
      getStep: () => step,
      canAdvance: () => canAdvanceFromStep(step, form),
    }),
    [step, form],
  );

  function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    if (step < TOTAL_STEPS) {
      goNext();
      return;
    }
    const step1 = validateAnamnesisStep(1, form);
    if (!step1.valid) {
      setErrors(step1.errors);
      setStep(1);
      return;
    }
    const step5 = validateAnamnesisStep(5, form);
    if (!step5.valid) {
      setErrors(step5.errors);
      setStep(5);
      return;
    }
    const step6 = validateAnamnesisStep(6, form);
    if (!step6.valid) {
      setErrors(step6.errors);
      setStep(6);
      return;
    }
    onSubmit(form, avatarFile, attachmentFiles);
  }

  return (
    <form id={formId} onSubmit={handleSubmit} className="space-y-5">
      <nav aria-label="Etapas do cadastro" className="space-y-3">
        <ol className="flex items-center gap-1 sm:gap-2">
          {WIZARD_STEPS.map((s, index) => {
            const active = s.id === step;
            const done = s.id < step;
            return (
              <li key={s.id} className="flex min-w-0 flex-1 items-center gap-1 sm:gap-2">
                <div className="flex min-w-0 flex-1 flex-col items-center gap-1.5">
                  <span
                    className={`flex h-8 w-8 items-center justify-center rounded-full text-xs font-semibold transition-colors ${
                      active
                        ? 'bg-primary text-white shadow-sm'
                        : done
                          ? 'bg-primary-50 text-primary ring-1 ring-primary/25'
                          : 'bg-slate-100 text-charcoal-muted'
                    }`}
                    aria-current={active ? 'step' : undefined}
                  >
                    {done ? (
                      <svg className="h-4 w-4" viewBox="0 0 20 20" fill="currentColor" aria-hidden>
                        <path
                          fillRule="evenodd"
                          d="M16.704 5.29a1 1 0 010 1.42l-7.25 7.25a1 1 0 01-1.42 0l-3.25-3.25a1 1 0 111.42-1.42l2.54 2.54 6.54-6.54a1 1 0 011.42 0z"
                          clipRule="evenodd"
                        />
                      </svg>
                    ) : (
                      s.id
                    )}
                  </span>
                  <span
                    className={`hidden max-w-full truncate text-center text-[11px] font-medium sm:block ${
                      active ? 'text-primary' : done ? 'text-charcoal' : 'text-charcoal-muted'
                    }`}
                  >
                    {s.label}
                  </span>
                </div>
                {index < WIZARD_STEPS.length - 1 && (
                  <div
                    className={`mb-5 hidden h-px flex-1 sm:block ${done ? 'bg-primary/40' : 'bg-slate-200'}`}
                    aria-hidden
                  />
                )}
              </li>
            );
          })}
        </ol>
        <p className="text-center text-xs font-medium text-charcoal-muted sm:hidden">
          Etapa {step} de {TOTAL_STEPS} — {WIZARD_STEPS[step - 1]?.label}
        </p>
      </nav>

      <div className="rounded-2xl border border-slate-100 bg-[#F8FAF9]/60 p-4 sm:p-5">
        {step === 1 && (
          <div className="space-y-5">
            <div className="grid grid-cols-1 gap-5 md:grid-cols-[auto_1fr] md:items-start md:gap-6">
              <div className="flex flex-col items-center md:items-start">
                <PatientPhotoUpload
                  name={form.name}
                  variant="wizard"
                  previewUrl={avatarPreview}
                  disabled={isSubmitting}
                  onFileSelected={handleAvatarSelected}
                  onValidationError={setAvatarError}
                />
                {avatarError && (
                  <p className="mt-2 text-center text-xs text-error md:text-left" role="alert">
                    {avatarError}
                  </p>
                )}
              </div>
              <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
                <Field label="Nome completo *" error={errors.name}>
                  <input
                    className={inputClass}
                    value={form.name}
                    onChange={(e) => patch('name', e.target.value)}
                    placeholder="Nome do paciente"
                    autoComplete="name"
                  />
                </Field>
                <Field label="Nome social" error={errors.nome_social}>
                  <input
                    className={inputClass}
                    value={form.nome_social}
                    onChange={(e) => patch('nome_social', e.target.value)}
                    placeholder="Se aplicável"
                  />
                </Field>
                <Field label="Data de nascimento *" error={errors.birth_date}>
                  <input
                    type="date"
                    className={inputClass}
                    value={form.birth_date}
                    onChange={(e) => patch('birth_date', e.target.value)}
                  />
                </Field>
                <Field label="Escolaridade / ocupação">
                  <input
                    className={inputClass}
                    value={form.escolaridade_ocupacao}
                    onChange={(e) => patch('escolaridade_ocupacao', e.target.value)}
                    placeholder="Ex.: 3º ano EF, estudante"
                  />
                </Field>
                <div className="sm:col-span-2">
                  <Field label="Diagnósticos * (separados por vírgula)" error={errors.diagnoses}>
                    <input
                      className={inputClass}
                      value={form.diagnoses}
                      onChange={(e) => patch('diagnoses', e.target.value)}
                      placeholder="TEA Nível 1, TDAH"
                    />
                  </Field>
                </div>
              </div>
            </div>
          </div>
        )}

        {step === 2 && (
          <div className="space-y-4">
            <Field label="Queixa principal">
              <textarea
                className={textareaClass}
                rows={3}
                value={form.queixa_principal}
                onChange={(e) => patch('queixa_principal', e.target.value)}
                placeholder="Motivo principal do acompanhamento..."
              />
            </Field>
            <Field label="Medicamentos em uso">
              <textarea
                className={textareaClass}
                rows={2}
                value={form.medicamentos}
                onChange={(e) => patch('medicamentos', e.target.value)}
                placeholder="Nome, dose e horário (se souber)"
              />
            </Field>
            <div>
              <p className="mb-2 text-sm font-medium text-charcoal">Acompanhamento multidisciplinar</p>
              <AcompanhamentoMultiField
                value={form.acompanhamento_multi}
                onChange={(next) => patch('acompanhamento_multi', next)}
                variant="clinical"
              />
            </div>
            <div>
              <p className="mb-2 text-sm font-medium text-charcoal">Documentos de referência</p>
              <PatientAttachmentDropzone
                disabled={isSubmitting}
                variant="light"
                label="Anexar laudos, relatórios ou exames"
                hint="Opcional. PDF, Word ou TXT — serão vetorizados após criar o paciente."
                onFilesSelected={(files) =>
                  setAttachmentFiles((current) => {
                    const names = new Set(current.map((file) => file.name));
                    return [...current, ...files.filter((file) => !names.has(file.name))];
                  })
                }
              />
              {attachmentFiles.length > 0 && (
                <ul className="mt-3 space-y-2">
                  {attachmentFiles.map((file) => (
                    <li
                      key={file.name}
                      className="flex items-center justify-between gap-3 rounded-xl border border-slate-200 bg-white px-3 py-2"
                    >
                      <div className="min-w-0">
                        <p className="truncate text-xs font-medium text-charcoal">{file.name}</p>
                        <p className="text-[11px] text-charcoal-muted">{formatAttachmentSize(file.size)}</p>
                      </div>
                      <button
                        type="button"
                        onClick={() =>
                          setAttachmentFiles((current) => current.filter((item) => item.name !== file.name))
                        }
                        className="text-xs text-charcoal-muted hover:text-charcoal"
                      >
                        Remover
                      </button>
                    </li>
                  ))}
                </ul>
              )}
            </div>
            <Field label="Observações clínicas iniciais">
              <textarea
                className={textareaClass}
                rows={2}
                value={form.clinical_observations}
                onChange={(e) => patch('clinical_observations', e.target.value)}
                placeholder="Anotações iniciais relevantes para o prontuário..."
              />
            </Field>
          </div>
        )}

        {step === 3 && (
          <div className="grid grid-cols-1 gap-4 md:grid-cols-2">
            <div className="md:col-span-2">
              <Field label="Composição familiar">
                <textarea
                  className={textareaClass}
                  rows={3}
                  value={form.composicao_familiar}
                  onChange={(e) => patch('composicao_familiar', e.target.value)}
                  placeholder="Quem mora com o paciente, vínculos e dinâmica do lar..."
                />
              </Field>
            </div>
            <div className="md:col-span-2">
              <Field label="Responsáveis pelo acompanhamento">
                <textarea
                  className={textareaClass}
                  rows={2}
                  value={form.responsaveis}
                  onChange={(e) => patch('responsaveis', e.target.value)}
                  placeholder="Nomes e contato dos cuidadores principais"
                />
              </Field>
            </div>
          </div>
        )}

        {step === 4 && (
          <div className="space-y-4">
            <Field label="Objetivos terapêuticos">
              <textarea
                className={textareaClass}
                rows={3}
                value={form.objetivos_terapeuticos}
                onChange={(e) => patch('objetivos_terapeuticos', e.target.value)}
                placeholder="Metas da família e do terapeuta para o acompanhamento..."
              />
            </Field>
            <Field label="Hiperfocos e interesses">
              <textarea
                className={textareaClass}
                rows={2}
                value={form.hiperfocos_interesses}
                onChange={(e) => patch('hiperfocos_interesses', e.target.value)}
                placeholder="Ex.: dinossauros, Minecraft, música — ajuda a IA a personalizar sugestões"
              />
            </Field>
            <Field label="Informações adicionais (opcional)">
              <textarea
                className={textareaClass}
                rows={4}
                value={form.informacoes_adicionais}
                onChange={(e) => patch('informacoes_adicionais', e.target.value)}
                placeholder="Qualquer contexto extra para o copiloto de IA conhecer melhor este paciente..."
              />
            </Field>
          </div>
        )}

        {step === 5 && (
          <div className="space-y-5">
            <div>
              <h3 className="font-serif text-base font-medium text-charcoal">Informações de contato</h3>
              <p className="mt-1.5 text-sm leading-relaxed text-charcoal-muted">
                É importante preencher as informações de contato para que possamos enviar lembretes
                por e-mail das sessões agendadas e outras comunicações do consultório.
              </p>
            </div>

            <fieldset className="space-y-2">
              <legend className="text-sm font-medium text-charcoal">Quem deseja cadastrar?</legend>
              <div className="grid grid-cols-1 gap-2 sm:grid-cols-3">
                {CONTACT_SCOPE_OPTIONS.map((option) => {
                  const selected = form.contact_scope === option.value;
                  return (
                    <button
                      key={option.value}
                      type="button"
                      onClick={() => patch('contact_scope', option.value as PatientContactScope)}
                      className={`rounded-xl border px-3 py-3 text-left transition-colors ${
                        selected
                          ? 'border-primary bg-primary-50 ring-1 ring-primary/25'
                          : 'border-slate-200 bg-white hover:border-primary/30'
                      }`}
                    >
                      <span className="block text-sm font-medium text-charcoal">{option.label}</span>
                      <span className="mt-0.5 block text-[11px] text-charcoal-muted">{option.hint}</span>
                    </button>
                  );
                })}
              </div>
              {errors.contact_scope && (
                <p className="text-xs text-error" role="alert">
                  {errors.contact_scope}
                </p>
              )}
            </fieldset>

            {(form.contact_scope === 'patient' || form.contact_scope === 'both') && (
              <div className="space-y-3 rounded-xl border border-slate-100 bg-white p-4">
                <p className="text-sm font-medium text-charcoal">Contato do paciente</p>
                <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
                  <Field label="E-mail *" error={errors.email_paciente}>
                    <input
                      type="email"
                      className={inputClass}
                      value={form.email_paciente}
                      onChange={(e) => patch('email_paciente', e.target.value)}
                      placeholder="paciente@email.com"
                      autoComplete="email"
                    />
                  </Field>
                  <div>
                    <PhoneInput
                      id="telefone-paciente"
                      label="Telefone (opcional)"
                      value={form.telefone_paciente}
                      onChange={(value) => patch('telefone_paciente', value)}
                      placeholder="(11) 99999-9999"
                    />
                  </div>
                </div>
              </div>
            )}

            {(form.contact_scope === 'responsible' || form.contact_scope === 'both') && (
              <div className="space-y-3 rounded-xl border border-slate-100 bg-white p-4">
                <p className="text-sm font-medium text-charcoal">Contato do responsável</p>
                <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
                  <Field label="E-mail *" error={errors.email_responsavel}>
                    <input
                      type="email"
                      className={inputClass}
                      value={form.email_responsavel}
                      onChange={(e) => patch('email_responsavel', e.target.value)}
                      placeholder="responsavel@email.com"
                      autoComplete="email"
                    />
                  </Field>
                  <div>
                    <PhoneInput
                      id="telefone-responsavel"
                      label="Telefone (opcional)"
                      value={form.telefone_responsavel}
                      onChange={(value) => patch('telefone_responsavel', value)}
                      placeholder="(11) 99999-9999"
                    />
                  </div>
                </div>
              </div>
            )}
          </div>
        )}

        {step === 6 && (
          <div className="space-y-5">
            <div>
              <h3 className="font-serif text-base font-medium text-charcoal">Modelo comercial</h3>
              <p className="mt-1.5 text-sm leading-relaxed text-charcoal-muted">
                Defina se o atendimento será avulso, por pacote mensal ou sessão social. Esses dados
                alimentam o Financeiro e a projeção de faturamento.
              </p>
            </div>

            <fieldset className="space-y-2">
              <legend className="text-sm font-medium text-charcoal">Tipo de acordo *</legend>
              <div className="grid grid-cols-1 gap-2 sm:grid-cols-3">
                {(
                  [
                    { value: 'avulso', label: 'Avulso', hint: 'Paga por sessão' },
                    { value: 'pacote', label: 'Pacote', hint: 'Crédito antecipado' },
                    { value: 'social', label: 'Social', hint: 'Valor simbólico/zero' },
                  ] as const
                ).map((option) => {
                  const selected = form.financeiro_modelo === option.value;
                  return (
                    <button
                      key={option.value}
                      type="button"
                      onClick={() => patch('financeiro_modelo', option.value)}
                      className={`rounded-xl border px-3 py-3 text-left transition-colors ${
                        selected
                          ? 'border-primary bg-primary-50 ring-1 ring-primary/25'
                          : 'border-slate-200 bg-white hover:border-primary/30'
                      }`}
                    >
                      <span className="block text-sm font-medium text-charcoal">{option.label}</span>
                      <span className="mt-0.5 block text-[11px] text-charcoal-muted">{option.hint}</span>
                    </button>
                  );
                })}
              </div>
              {errors.financeiro_modelo && (
                <p className="text-xs text-error" role="alert">
                  {errors.financeiro_modelo}
                </p>
              )}
            </fieldset>

            <Field label="Valor da sessão (R$)">
              <input
                className={inputClass}
                value={form.financeiro_valor_sessao}
                onChange={(e) => patch('financeiro_valor_sessao', e.target.value)}
                placeholder="150,00"
                inputMode="decimal"
              />
            </Field>

            {form.financeiro_modelo === 'pacote' && (
              <div className="space-y-3 rounded-xl border border-slate-100 bg-white p-4">
                <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
                  <Field label="Quantidade de sessões *" error={errors.financeiro_pacote_qtd}>
                    <input
                      className={inputClass}
                      value={form.financeiro_pacote_qtd}
                      onChange={(e) => patch('financeiro_pacote_qtd', e.target.value)}
                      inputMode="numeric"
                    />
                  </Field>
                  <Field label="Valor do pacote (R$)">
                    <input
                      className={inputClass}
                      value={form.financeiro_pacote_valor}
                      onChange={(e) => patch('financeiro_pacote_valor', e.target.value)}
                      inputMode="decimal"
                    />
                  </Field>
                </div>
                <label className="flex items-center gap-2 text-sm text-charcoal">
                  <input
                    type="checkbox"
                    checked={form.financeiro_registrar_pacote_pago}
                    onChange={(e) => patch('financeiro_registrar_pacote_pago', e.target.checked)}
                    className="rounded border-slate-300 text-primary"
                  />
                  Pacote já pago — creditar saldo agora
                </label>
              </div>
            )}

            <Field label="Observações comerciais (opcional)">
              <textarea
                className={textareaClass}
                rows={2}
                value={form.financeiro_observacoes}
                onChange={(e) => patch('financeiro_observacoes', e.target.value)}
                placeholder="Ex.: reajuste em 90 dias, desconto familiar..."
              />
            </Field>
          </div>
        )}
      </div>
    </form>
  );
});

function Field({
  label,
  error,
  children,
}: {
  label: string;
  error?: string;
  children: React.ReactNode;
}) {
  return (
    <div>
      <label className="mb-1.5 block text-sm font-medium text-charcoal">{label}</label>
      {children}
      {error && (
        <p className="mt-1 text-xs text-error" role="alert">
          {error}
        </p>
      )}
    </div>
  );
}
