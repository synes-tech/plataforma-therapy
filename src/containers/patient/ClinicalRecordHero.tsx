import { DiagnosisChips } from '@features/patients/DiagnosisChips';
import { PatientPhotoUpload } from './PatientPhotoUpload';
import { parseDiagnoses } from './patient-anamnesis.types';

interface ClinicalRecordHeroProps {
  patientName: string;
  birthDateLabel: string;
  diagnosesRaw: string;
  fotoUrl: string | null;
  photoPreview: string | null;
  uploadingPhoto: boolean;
  editing: boolean;
  generatingPdf?: boolean;
  onStartEdit: () => void;
  onGeneratePdf: () => void;
  onPhotoSelected: (file: File) => void;
  onPhotoValidationError: (message: string) => void;
}

function PdfIcon() {
  return (
    <svg className="h-4 w-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2} aria-hidden>
      <path strokeLinecap="round" strokeLinejoin="round" d="M12 10v6m0 0l-3-3m3 3l3-3m2 8H7a2 2 0 01-2-2V5a2 2 0 012-2h5.586a1 1 0 01.707.293l5.414 5.414a1 1 0 01.293.707V19a2 2 0 01-2 2z" />
    </svg>
  );
}

function PencilIcon() {
  return (
    <svg className="h-4 w-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2} aria-hidden>
      <path strokeLinecap="round" strokeLinejoin="round" d="M11 5H6a2 2 0 00-2 2v11a2 2 0 002 2h11a2 2 0 002-2v-5m-1.414-9.414a2 2 0 112.828 2.828L11.828 15H9v-2.828l8.586-8.586z" />
    </svg>
  );
}

export function ClinicalRecordHero({
  patientName,
  birthDateLabel,
  diagnosesRaw,
  fotoUrl,
  photoPreview,
  uploadingPhoto,
  editing,
  generatingPdf = false,
  onStartEdit,
  onGeneratePdf,
  onPhotoSelected,
  onPhotoValidationError,
}: ClinicalRecordHeroProps) {
  const diagnoses = parseDiagnoses(diagnosesRaw);

  return (
    <section className="mb-6 rounded-2xl border border-slate-100 bg-white p-5 shadow-sm sm:p-6">
      <div className="flex flex-col items-center gap-5 text-center lg:flex-row lg:items-center lg:gap-8 lg:text-left">
        <div className="flex shrink-0 flex-col items-center lg:items-start">
          <PatientPhotoUpload
            name={patientName}
            fotoUrl={fotoUrl}
            previewUrl={photoPreview}
            variant="hero"
            disabled={uploadingPhoto}
            onFileSelected={onPhotoSelected}
            onValidationError={onPhotoValidationError}
          />
          {uploadingPhoto && (
            <p className="mt-2 text-xs font-medium text-primary">Enviando foto...</p>
          )}
        </div>

        <div className="min-w-0 flex-1">
          <p className="text-xs font-semibold uppercase tracking-wider text-charcoal-muted">
            Ficha clínica
          </p>
          <h2 className="mt-1 font-serif text-2xl font-medium tracking-tight text-charcoal">
            {patientName || 'Paciente'}
          </h2>
          {birthDateLabel && (
            <p className="mt-1 text-sm text-charcoal-muted">Nascimento: {birthDateLabel}</p>
          )}
          {diagnoses.length > 0 && (
            <div className="mt-3 flex justify-center lg:justify-start">
              <DiagnosisChips diagnoses={diagnoses} max={6} />
            </div>
          )}
          <p className="mt-3 max-w-md text-sm text-charcoal-muted">
            Anamnese utilizada pelo copiloto de IA para personalizar recomendações e contexto clínico.
          </p>
        </div>

        {!editing && (
          <div className="flex w-full flex-col gap-2 lg:w-auto lg:shrink-0">
            <button
              type="button"
              onClick={onStartEdit}
              className="hidden min-h-[44px] shrink-0 items-center justify-center gap-2 rounded-xl border border-slate-200 bg-white px-5 text-sm font-medium text-charcoal shadow-sm transition-all hover:border-primary/40 hover:text-primary active:scale-[0.98] lg:inline-flex"
            >
              <PencilIcon />
              Editar Ficha
            </button>
            <button
              type="button"
              onClick={onGeneratePdf}
              disabled={generatingPdf}
              aria-busy={generatingPdf}
              className="inline-flex min-h-[44px] w-full items-center justify-center gap-2 rounded-xl border border-slate-200 bg-white px-5 text-sm font-medium text-charcoal shadow-sm transition-all hover:border-primary/40 hover:text-primary active:scale-[0.98] disabled:cursor-not-allowed disabled:opacity-50 lg:w-auto"
            >
              {generatingPdf ? (
                <>
                  <span className="h-4 w-4 animate-spin rounded-full border-2 border-primary border-t-transparent" />
                  Gerando PDF...
                </>
              ) : (
                <>
                  <PdfIcon />
                  Gerar PDF
                </>
              )}
            </button>
          </div>
        )}
      </div>
    </section>
  );
}

export function ClinicalRecordEditFab({
  visible,
  onClick,
}: {
  visible: boolean;
  onClick: () => void;
}) {
  if (!visible) return null;

  return (
    <button
      type="button"
      onClick={onClick}
      className="fixed bottom-6 right-4 z-40 inline-flex min-h-12 min-w-[3rem] items-center justify-center gap-2 rounded-full border border-primary/20 bg-primary px-5 text-sm font-semibold text-white shadow-lg shadow-primary/25 transition-transform active:scale-95 lg:hidden"
      aria-label="Editar ficha clínica"
    >
      <PencilIcon />
      Editar
    </button>
  );
}
