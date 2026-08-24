import {
  forwardRef,
  useCallback,
  useEffect,
  useImperativeHandle,
  useState,
} from 'react';
import {
  EMPTY_ANAMNESIS_FORM,
  TOTAL_WIZARD_STEPS,
  portalScopeOptionsForProfile,
  profileFromForm,
  wizardStepsForProfile,
  type PatientAnamnesisForm,
  type PatientContactScope,
} from './patient-anamnesis.types';
import {
  REQUIRED_WIZARD_STEPS,
  canAdvanceFromStep,
  validateAnamnesisStep,
} from './patient-anamnesis.validation';
import { PatientPhotoUpload } from './PatientPhotoUpload';
import { PatientProfileTypeCards } from './PatientProfileTypeCards';
import { PatientConditionPicker } from './PatientConditionPicker';
import { AcompanhamentoMultiField } from './AcompanhamentoMultiField';
import { PatientAttachmentDropzone } from './attachments/PatientAttachmentDropzone';
import { formatAttachmentSize } from './attachments/patient-attachment.utils';
import { PhoneInput } from '@features/register/PhoneInput';
import { PatientContractFields, type PatientContractFormValues } from './PatientContractFields';

const TOTAL_STEPS = TOTAL_WIZARD_STEPS;

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

  const profile = profileFromForm(form);
  const isAdult = profile === 'ADULT';
  const steps = wizardStepsForProfile(profile);
  const portalOptions = portalScopeOptionsForProfile(profile);

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

  /**
   * Corrigir a data de nascimento pode invalidar a escolha de acesso já feita — "o próprio
   * paciente" não existe para um menor. Limpar é mais honesto que deixar uma seleção
   * fantasma que o backend recusaria no fim.
   */
  useEffect(() => {
    if (!form.contact_scope) return;
    if (portalOptions.some((option) => option.value === form.contact_scope)) return;
    setForm((current) => ({ ...current, contact_scope: '' }));
  }, [form.contact_scope, portalOptions]);

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
    for (const required of REQUIRED_WIZARD_STEPS) {
      const result = validateAnamnesisStep(required, form);
      if (!result.valid) {
        setErrors(result.errors);
        setStep(required);
        return;
      }
    }
    onSubmit(form, avatarFile, attachmentFiles);
  }

  return (
    <form id={formId} onSubmit={handleSubmit} className="space-y-5">
      <nav aria-label="Etapas do cadastro" className="space-y-3">
        <ol className="flex items-center gap-1 sm:gap-2">
          {steps.map((s, index) => {
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
                {index < steps.length - 1 && (
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
          Etapa {step} de {TOTAL_STEPS} — {steps[step - 1]?.label}
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
                <Field label={isAdult ? 'Formação / ocupação' : 'Escolaridade / ocupação'}>
                  <input
                    className={inputClass}
                    value={form.escolaridade_ocupacao}
                    onChange={(e) => patch('escolaridade_ocupacao', e.target.value)}
                    placeholder={isAdult ? 'Ex.: designer, superior completo' : 'Ex.: 3º ano EF, estudante'}
                  />
                </Field>
              </div>
            </div>

            <PatientProfileTypeCards birthDate={form.birth_date} profile={profile} />

            <PatientConditionPicker
              selected={form.conditions}
              freeText={form.diagnoses}
              onChangeSelected={(next) => patch('conditions', next)}
              onChangeFreeText={(next) => patch('diagnoses', next)}
              error={errors.conditions}
              disabled={isSubmitting}
            />
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

        {/* Passo 3 — o contexto de quem cuida (menor) ou de com quem se conta (adulto). */}
        {step === 3 && isAdult && (
          <div className="space-y-4">
            <StepIntro
              title="Rede de apoio e rotina"
              description="Com quem este paciente conta e como são os dias dele. É esse contexto que permite ao copiloto sugerir intervenções que cabem na vida real, não no vácuo."
            />
            <Field label="Rede de apoio" error={errors.support_network}>
              <textarea
                className={textareaClass}
                rows={3}
                value={form.support_network}
                onChange={(e) => patch('support_network', e.target.value)}
                placeholder="Parceiro(a), família, amigos próximos, grupos, terapeutas — quem ele procura quando precisa"
              />
            </Field>
            <Field label="Ocupação e rotina">
              <textarea
                className={textareaClass}
                rows={3}
                value={form.occupation_routine}
                onChange={(e) => patch('occupation_routine', e.target.value)}
                placeholder="Trabalho, estudos, sono, exercício, uso de substâncias — como se organiza um dia comum"
              />
            </Field>
          </div>
        )}

        {step === 3 && !isAdult && (
          <div className="space-y-4">
            <StepIntro
              title="Dinâmica familiar e cuidadores"
              description="Quem convive com o paciente e quem responde pelo acompanhamento. O convite do portal vai para esse responsável."
            />
            <Field label="Composição familiar *" error={errors.composicao_familiar}>
              <textarea
                className={textareaClass}
                rows={3}
                value={form.composicao_familiar}
                onChange={(e) => patch('composicao_familiar', e.target.value)}
                placeholder="Quem mora com o paciente, vínculos e dinâmica do lar..."
              />
            </Field>
            <Field label="Responsáveis pelo acompanhamento *" error={errors.responsaveis}>
              <textarea
                className={textareaClass}
                rows={2}
                value={form.responsaveis}
                onChange={(e) => patch('responsaveis', e.target.value)}
                placeholder="Nomes e grau de parentesco dos cuidadores principais"
              />
            </Field>
          </div>
        )}

        {/* Passo 4 — o que a IA precisa saber muda com a idade. */}
        {step === 4 && (
          <div className="space-y-4">
            <StepIntro
              title="O que o copiloto precisa saber"
              description="Estes campos alimentam as sugestões da IA. Quanto mais concreto, mais útil."
            />
            <Field
              label={
                isAdult
                  ? 'Objetivos da psicoterapia (curto e longo prazo)'
                  : 'Objetivos terapêuticos'
              }
            >
              <textarea
                className={textareaClass}
                rows={3}
                value={form.objetivos_terapeuticos}
                onChange={(e) => patch('objetivos_terapeuticos', e.target.value)}
                placeholder={
                  isAdult
                    ? 'O que o paciente quer alcançar nas próximas semanas e no processo como um todo'
                    : 'Metas da família e do terapeuta para o acompanhamento...'
                }
              />
            </Field>

            {!isAdult && (
              <Field label="Hiperfocos e interesses">
                <textarea
                  className={textareaClass}
                  rows={2}
                  value={form.hiperfocos_interesses}
                  onChange={(e) => patch('hiperfocos_interesses', e.target.value)}
                  placeholder="Ex.: dinossauros, Minecraft, música — a IA usa isso para propor atividades que engajam"
                />
              </Field>
            )}

            {profile !== 'CHILD' && (
              <Field label="Gatilhos mapeados">
                <textarea
                  className={textareaClass}
                  rows={2}
                  value={form.mapped_triggers}
                  onChange={(e) => patch('mapped_triggers', e.target.value)}
                  placeholder="Situações, lugares ou temas que costumam desencadear crise ou sofrimento intenso"
                />
              </Field>
            )}

            <Field label="Informações adicionais (opcional)">
              <textarea
                className={textareaClass}
                rows={4}
                value={form.informacoes_adicionais}
                onChange={(e) => patch('informacoes_adicionais', e.target.value)}
                placeholder="Qualquer contexto extra para o copiloto conhecer melhor este paciente..."
              />
            </Field>
          </div>
        )}

        {step === 5 && (
          <div className="space-y-5">
            <StepIntro
              title="Quem terá acesso ao Portal Unithery?"
              description="Quem você escolher recebe por e-mail um convite para o portal, onde registra o dia a dia e lê o que você liberar. Os mesmos contatos recebem os lembretes de sessão."
            />

            <fieldset className="space-y-2">
              <legend className="sr-only">Quem terá acesso ao portal</legend>
              <div
                className={`grid grid-cols-1 gap-2 ${portalOptions.length === 3 ? 'sm:grid-cols-3' : 'sm:grid-cols-2'}`}
              >
                {portalOptions.map((option) => {
                  const selected = form.contact_scope === option.value;
                  return (
                    <button
                      key={option.value}
                      type="button"
                      aria-pressed={selected}
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
              {!isAdult && profile && (
                <p className="text-[11px] leading-snug text-charcoal-muted">
                  Pacientes menores de idade acessam o portal pelo responsável. O acesso próprio
                  exige consentimento registrado e pode ser concedido depois, na ficha do paciente.
                </p>
              )}
            </fieldset>

            <label className="flex cursor-pointer items-start gap-3 rounded-xl border border-slate-200 bg-white px-4 py-3">
              <input
                type="checkbox"
                checked={form.portal_invite_send}
                onChange={(e) => patch('portal_invite_send', e.target.checked)}
                className="mt-0.5 h-4 w-4 rounded border-slate-300 text-primary focus:ring-primary/20"
              />
              <span>
                <span className="block text-sm font-medium text-charcoal">
                  Enviar o convite agora
                </span>
                <span className="mt-0.5 block text-[11px] text-charcoal-muted">
                  Se preferir, deixe desmarcado e envie depois pela ficha do paciente. O cadastro é
                  concluído do mesmo jeito.
                </span>
              </span>
            </label>

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
                <p className="text-sm font-medium text-charcoal">
                  {isAdult ? 'Contato da pessoa de apoio' : 'Contato do responsável'}
                </p>
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
            <StepIntro
              title="Contrato financeiro"
              description="Obrigatório para cadastrar o paciente. Particular ou convênio, avulso ou mensalidade — esses dados alimentam o caixa e, se for mensal, a agenda recorrente."
            />
            <PatientContractFields
              value={{
                model_type: form.financeiro_model_type,
                billing_type: form.financeiro_billing_type,
                valor: form.financeiro_valor_sessao,
                due_day: form.financeiro_due_day,
                sessions_per_month: form.financeiro_sessions_per_month,
                sessions_custom: form.financeiro_sessions_custom,
                duration_months: form.financeiro_duration_months,
                pacote_qtd: form.financeiro_pacote_qtd,
                pacote_valor: form.financeiro_pacote_valor,
                registrar_pacote_pago: form.financeiro_registrar_pacote_pago,
                observacoes: form.financeiro_observacoes,
              }}
              onChange={(next: Partial<PatientContractFormValues>) => {
                setForm((current) => {
                  const updated = {
                    ...current,
                    financeiro_model_type: next.model_type ?? current.financeiro_model_type,
                    financeiro_billing_type: next.billing_type ?? current.financeiro_billing_type,
                    financeiro_valor_sessao: next.valor ?? current.financeiro_valor_sessao,
                    financeiro_due_day: next.due_day ?? current.financeiro_due_day,
                    financeiro_sessions_per_month: next.sessions_per_month ?? current.financeiro_sessions_per_month,
                    financeiro_sessions_custom: next.sessions_custom ?? current.financeiro_sessions_custom,
                    financeiro_duration_months: next.duration_months ?? current.financeiro_duration_months,
                    financeiro_pacote_qtd: next.pacote_qtd ?? current.financeiro_pacote_qtd,
                    financeiro_pacote_valor: next.pacote_valor ?? current.financeiro_pacote_valor,
                    financeiro_registrar_pacote_pago:
                      next.registrar_pacote_pago ?? current.financeiro_registrar_pacote_pago,
                    financeiro_observacoes: next.observacoes ?? current.financeiro_observacoes,
                    financeiro_modelo:
                      (next.billing_type ?? current.financeiro_billing_type) === 'PACOTE'
                        ? 'pacote'
                        : (next.billing_type ?? current.financeiro_billing_type)
                          ? 'avulso'
                          : current.financeiro_modelo,
                  };
                  const result = validateAnamnesisStep(6, updated);
                  setErrors(result.errors);
                  return updated;
                });
              }}
              errors={errors}
            />
          </div>
        )}
      </div>
    </form>
  );
});

function StepIntro({ title, description }: { title: string; description: string }) {
  return (
    <div>
      <h3 className="font-serif text-base font-medium text-charcoal">{title}</h3>
      <p className="mt-1.5 text-sm leading-relaxed text-charcoal-muted">{description}</p>
    </div>
  );
}

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
