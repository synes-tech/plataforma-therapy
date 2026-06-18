import { useState, useEffect, useCallback } from 'react';
import {
  ACOMPANHAMENTO_OPTIONS,
  type PatientAnamnesisForm,
} from './patient-anamnesis.types';
import { validateClinicalRecordForm } from './patient-anamnesis.validation';
import { uploadPatientAvatarFile } from './patient-avatar.upload';
import { Toast } from './Toast';
import { ClinicalFieldGroup, ClinicalValue } from './ClinicalRecordField';
import {
  ClinicalRecordSectionCard,
  ClinicalFieldsGrid,
  ClinicalFieldsStack,
} from './ClinicalRecordSectionCard';
import { ClinicalRecordHero, ClinicalRecordEditFab } from './ClinicalRecordHero';

interface PatientClinicalRecordTabProps {
  patientId: string;
  patientName: string;
  fotoUrl: string | null;
  onFotoUpdated: (fotoUrl: string) => void;
  form: PatientAnamnesisForm;
  onChange: (form: PatientAnamnesisForm) => void;
  onSave: () => void;
  onCancelEdit: () => void;
  isSaving: boolean;
  saveError: string | null;
  isDirty: boolean;
}

const inputClass =
  'h-11 min-h-[44px] w-full rounded-xl border border-slate-200 bg-white px-4 text-sm text-charcoal transition-all placeholder:text-charcoal-muted/40 focus:border-primary/50 focus:outline-none focus:ring-[3px] focus:ring-primary/10 disabled:bg-slate-50 disabled:text-charcoal-muted';

const textareaClass =
  'w-full rounded-xl border border-slate-200 bg-white px-4 py-3 text-sm text-charcoal transition-all placeholder:text-charcoal-muted/40 focus:border-primary/50 focus:outline-none focus:ring-[3px] focus:ring-primary/10 disabled:bg-slate-50 disabled:text-charcoal-muted';

function formatBirthDate(iso: string): string {
  if (!iso) return '';
  return new Date(iso + 'T12:00:00').toLocaleDateString('pt-BR');
}

export function PatientClinicalRecordTab({
  patientId,
  patientName,
  fotoUrl,
  onFotoUpdated,
  form,
  onChange,
  onSave,
  onCancelEdit,
  isSaving,
  saveError,
  isDirty,
}: PatientClinicalRecordTabProps) {
  const [editing, setEditing] = useState(false);
  const [uploadingPhoto, setUploadingPhoto] = useState(false);
  const [photoPreview, setPhotoPreview] = useState<string | null>(null);
  const [toast, setToast] = useState<{ message: string; variant: 'success' | 'error' } | null>(null);
  const validation = validateClinicalRecordForm(form);
  const errors = validation.errors;
  const readOnly = !editing;

  useEffect(() => {
    return () => {
      if (photoPreview) URL.revokeObjectURL(photoPreview);
    };
  }, [photoPreview]);

  const handlePhotoSelected = useCallback(
    async (file: File) => {
      const preview = URL.createObjectURL(file);
      setPhotoPreview((prev) => {
        if (prev) URL.revokeObjectURL(prev);
        return preview;
      });
      setUploadingPhoto(true);
      try {
        const newPath = await uploadPatientAvatarFile(patientId, file);
        onFotoUpdated(newPath);
        setToast({ message: 'Foto atualizada com sucesso', variant: 'success' });
      } catch (err) {
        setPhotoPreview((prev) => {
          if (prev) URL.revokeObjectURL(prev);
          return null;
        });
        setToast({
          message: err instanceof Error ? err.message : 'Não foi possível atualizar a foto',
          variant: 'error',
        });
      } finally {
        setUploadingPhoto(false);
      }
    },
    [patientId, onFotoUpdated],
  );

  function patch<K extends keyof PatientAnamnesisForm>(key: K, value: PatientAnamnesisForm[K]) {
    onChange({ ...form, [key]: value });
  }

  function toggleAcompanhamento(option: string) {
    const has = form.acompanhamento_multi.includes(option);
    patch(
      'acompanhamento_multi',
      has ? form.acompanhamento_multi.filter((x) => x !== option) : [...form.acompanhamento_multi, option],
    );
  }

  function startEdit() {
    setEditing(true);
  }

  function cancelEdit() {
    onCancelEdit();
    setEditing(false);
  }

  function handleSave() {
    if (!validation.valid) return;
    onSave();
    setEditing(false);
  }

  return (
    <div className="relative pb-28 lg:pb-24">
      <Toast
        message={toast?.message ?? ''}
        visible={!!toast}
        variant={toast?.variant}
        onDismiss={() => setToast(null)}
      />

      <ClinicalRecordHero
        patientName={form.name || patientName}
        birthDateLabel={formatBirthDate(form.birth_date)}
        diagnosesRaw={form.diagnoses}
        fotoUrl={fotoUrl}
        photoPreview={photoPreview}
        uploadingPhoto={uploadingPhoto}
        editing={editing}
        onStartEdit={startEdit}
        onPhotoSelected={(file) => void handlePhotoSelected(file)}
        onPhotoValidationError={(message) => setToast({ message, variant: 'error' })}
      />

      <ClinicalRecordEditFab visible={!editing} onClick={startEdit} />

      {isDirty && !editing && (
        <div
          role="status"
          className="mb-4 rounded-xl border border-amber-200/80 bg-amber-50 px-4 py-3 text-sm text-amber-900"
        >
          Você tem alterações não salvas nesta ficha. Toque em Editar para concluir ou descartar.
        </div>
      )}

      {saveError && (
        <div
          role="alert"
          className="mb-4 rounded-xl border border-error/20 bg-error-light px-4 py-3 text-sm text-error"
        >
          {saveError}
        </div>
      )}

      <div className="flex flex-col gap-6">
        <ClinicalRecordSectionCard
          title="Dados Básicos"
          description="Identificação e diagnósticos principais"
        >
          <ClinicalFieldsGrid>
            <ClinicalFieldGroup label="Nome completo *" error={errors.name}>
              {readOnly ? (
                <ClinicalValue value={form.name} />
              ) : (
                <input
                  className={inputClass}
                  value={form.name}
                  onChange={(e) => patch('name', e.target.value)}
                  autoComplete="name"
                />
              )}
            </ClinicalFieldGroup>

            <ClinicalFieldGroup label="Nome social">
              {readOnly ? (
                <ClinicalValue value={form.nome_social} />
              ) : (
                <input
                  className={inputClass}
                  value={form.nome_social}
                  onChange={(e) => patch('nome_social', e.target.value)}
                />
              )}
            </ClinicalFieldGroup>

            <ClinicalFieldGroup label="Data de nascimento *" error={errors.birth_date}>
              {readOnly ? (
                <ClinicalValue value={formatBirthDate(form.birth_date)} />
              ) : (
                <input
                  type="date"
                  className={inputClass}
                  value={form.birth_date}
                  onChange={(e) => patch('birth_date', e.target.value)}
                />
              )}
            </ClinicalFieldGroup>

            <ClinicalFieldGroup label="Escolaridade / ocupação">
              {readOnly ? (
                <ClinicalValue value={form.escolaridade_ocupacao} />
              ) : (
                <input
                  className={inputClass}
                  value={form.escolaridade_ocupacao}
                  onChange={(e) => patch('escolaridade_ocupacao', e.target.value)}
                />
              )}
            </ClinicalFieldGroup>

            <ClinicalFieldGroup label="Diagnósticos *" error={errors.diagnoses} fullWidth>
              {readOnly ? (
                <ClinicalValue value={form.diagnoses} />
              ) : (
                <input
                  className={inputClass}
                  value={form.diagnoses}
                  onChange={(e) => patch('diagnoses', e.target.value)}
                  placeholder="TEA, TDAH"
                />
              )}
            </ClinicalFieldGroup>
          </ClinicalFieldsGrid>
        </ClinicalRecordSectionCard>

        <ClinicalRecordSectionCard
          title="Contexto Clínico"
          description="Queixa, medicação e observações iniciais"
        >
          <ClinicalFieldsStack>
            <ClinicalFieldGroup label="Queixa principal" fullWidth>
              {readOnly ? (
                <ClinicalValue multiline value={form.queixa_principal} />
              ) : (
                <textarea
                  className={textareaClass}
                  rows={3}
                  value={form.queixa_principal}
                  onChange={(e) => patch('queixa_principal', e.target.value)}
                />
              )}
            </ClinicalFieldGroup>

            <ClinicalFieldGroup label="Medicamentos em uso" fullWidth>
              {readOnly ? (
                <ClinicalValue multiline value={form.medicamentos} />
              ) : (
                <textarea
                  className={textareaClass}
                  rows={2}
                  value={form.medicamentos}
                  onChange={(e) => patch('medicamentos', e.target.value)}
                />
              )}
            </ClinicalFieldGroup>

            <ClinicalFieldGroup label="Acompanhamento multidisciplinar" fullWidth>
              {readOnly ? (
                <ClinicalValue
                  value={
                    form.acompanhamento_multi.length
                      ? form.acompanhamento_multi.join(' · ')
                      : ''
                  }
                />
              ) : (
                <div className="flex flex-wrap gap-2">
                  {ACOMPANHAMENTO_OPTIONS.map((opt) => {
                    const selected = form.acompanhamento_multi.includes(opt);
                    return (
                      <button
                        key={opt}
                        type="button"
                        onClick={() => toggleAcompanhamento(opt)}
                        className={`min-h-[44px] rounded-full px-4 py-2 text-xs font-medium transition-all ${
                          selected
                            ? 'bg-primary text-white'
                            : 'border border-slate-200 bg-white text-charcoal-muted hover:border-primary/30'
                        }`}
                      >
                        {opt}
                      </button>
                    );
                  })}
                </div>
              )}
            </ClinicalFieldGroup>

            <ClinicalFieldGroup label="Observações clínicas iniciais" fullWidth>
              {readOnly ? (
                <ClinicalValue multiline value={form.clinical_observations} />
              ) : (
                <textarea
                  className={textareaClass}
                  rows={2}
                  value={form.clinical_observations}
                  onChange={(e) => patch('clinical_observations', e.target.value)}
                />
              )}
            </ClinicalFieldGroup>
          </ClinicalFieldsStack>
        </ClinicalRecordSectionCard>

        <ClinicalRecordSectionCard
          title="Dinâmica Familiar"
          description="Composição do núcleo e responsáveis legais"
        >
          <ClinicalFieldsStack>
            <ClinicalFieldGroup label="Composição familiar" fullWidth>
              {readOnly ? (
                <ClinicalValue multiline value={form.composicao_familiar} />
              ) : (
                <textarea
                  className={textareaClass}
                  rows={3}
                  value={form.composicao_familiar}
                  onChange={(e) => patch('composicao_familiar', e.target.value)}
                />
              )}
            </ClinicalFieldGroup>

            <ClinicalFieldGroup label="Responsáveis" fullWidth>
              {readOnly ? (
                <ClinicalValue multiline value={form.responsaveis} />
              ) : (
                <textarea
                  className={textareaClass}
                  rows={2}
                  value={form.responsaveis}
                  onChange={(e) => patch('responsaveis', e.target.value)}
                />
              )}
            </ClinicalFieldGroup>
          </ClinicalFieldsStack>
        </ClinicalRecordSectionCard>

        <ClinicalRecordSectionCard
          title="Parametrização IA"
          description="Contexto para o copiloto e recomendações personalizadas"
        >
          <ClinicalFieldsStack>
            <ClinicalFieldGroup label="Objetivos terapêuticos" fullWidth>
              {readOnly ? (
                <ClinicalValue multiline value={form.objetivos_terapeuticos} />
              ) : (
                <textarea
                  className={textareaClass}
                  rows={3}
                  value={form.objetivos_terapeuticos}
                  onChange={(e) => patch('objetivos_terapeuticos', e.target.value)}
                />
              )}
            </ClinicalFieldGroup>

            <ClinicalFieldGroup label="Hiperfocos e interesses" fullWidth>
              {readOnly ? (
                <ClinicalValue multiline value={form.hiperfocos_interesses} />
              ) : (
                <textarea
                  className={textareaClass}
                  rows={2}
                  value={form.hiperfocos_interesses}
                  onChange={(e) => patch('hiperfocos_interesses', e.target.value)}
                />
              )}
            </ClinicalFieldGroup>

            <ClinicalFieldGroup label="Informações adicionais" fullWidth>
              {readOnly ? (
                <ClinicalValue multiline value={form.informacoes_adicionais} />
              ) : (
                <textarea
                  className={`${textareaClass} min-h-[120px]`}
                  rows={5}
                  value={form.informacoes_adicionais}
                  onChange={(e) => patch('informacoes_adicionais', e.target.value)}
                />
              )}
            </ClinicalFieldGroup>
          </ClinicalFieldsStack>
        </ClinicalRecordSectionCard>
      </div>

      {editing && (
        <div className="fixed bottom-0 left-0 right-0 z-50 border-t border-slate-200 bg-white/95 px-4 py-4 backdrop-blur-md safe-area-pb lg:px-8">
          <div className="mx-auto flex max-w-4xl flex-col-reverse gap-3 sm:flex-row sm:justify-end">
            <button
              type="button"
              onClick={cancelEdit}
              disabled={isSaving}
              className="inline-flex min-h-12 w-full items-center justify-center rounded-xl border border-slate-200 px-5 text-sm font-medium text-charcoal-muted hover:bg-slate-50 disabled:opacity-50 sm:w-auto"
            >
              Cancelar
            </button>
            <button
              type="button"
              onClick={handleSave}
              disabled={isSaving || !validation.valid || !isDirty}
              className="inline-flex min-h-12 w-full items-center justify-center rounded-xl bg-primary px-6 text-sm font-medium text-white shadow-sm hover:bg-primary-dark disabled:opacity-50 sm:w-auto"
            >
              {isSaving ? 'Salvando...' : 'Salvar alterações'}
            </button>
          </div>
        </div>
      )}
    </div>
  );
}
