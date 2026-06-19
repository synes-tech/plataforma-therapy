import { useNavigate } from 'react-router-dom';
import { ExportPdfButton } from '@features/pdf/ExportPdfButton';
import { PageHeader } from '@containers/layout';
import { PatientAvatar } from './PatientAvatar';
import { FamilyDiaryAlertButton } from './family-diary/FamilyDiaryAlertButton';
import { PatientFamilyInviteButton } from './PatientFamilyInvite';
import { PatientLinkManageFlow } from './PatientLinkManageFlow';
import { PatientRecordTabs } from './PatientRecordTabs';
import { RecordSessionButton } from './RecordSessionButton';
import type { PatientInfo, PatientRecordTab } from './patient-record.types';

interface PatientRecordPageHeaderProps {
  patient: PatientInfo;
  age: number;
  diaryCount: number;
  onDiaryOpen: () => void;
  onFamilyInvite: () => void;
  activeTab: PatientRecordTab;
  onTabChange: (tab: PatientRecordTab) => void;
  clinicalDirty?: boolean;
  bleed?: boolean;
}

function SparkIcon({ className = 'h-4 w-4' }: { className?: string }) {
  return (
    <svg className={className} fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2} aria-hidden>
      <path strokeLinecap="round" strokeLinejoin="round" d="M9.813 15.904L9 18.75l-.813-2.846a4.5 4.5 0 00-3.09-3.09L2.25 12l2.846-.813a4.5 4.5 0 003.09-3.09L9 5.25l.813 2.846a4.5 4.5 0 003.09 3.09L15.75 12l-2.846.813a4.5 4.5 0 00-3.09 3.09z" />
    </svg>
  );
}

const btnPrimary =
  'inline-flex h-9 shrink-0 items-center justify-center gap-1.5 rounded-lg bg-primary px-3 text-xs font-semibold text-white shadow-sm transition-all hover:bg-primary-dark active:scale-[0.98] sm:px-4';

const btnIcon =
  'inline-flex h-9 w-9 shrink-0 items-center justify-center rounded-lg border border-slate-200 bg-white text-charcoal transition-colors hover:border-charcoal/30 sm:hidden';

export function PatientRecordPageHeader({
  patient,
  age,
  diaryCount,
  onDiaryOpen,
  onFamilyInvite,
  activeTab,
  onTabChange,
  clinicalDirty,
  bleed = true,
}: PatientRecordPageHeaderProps) {
  const navigate = useNavigate();

  function goCopilot() {
    if (activeTab !== 'copilot') onTabChange('copilot');
  }

  function goRecordSession() {
    navigate(`/session/${patient.id}`);
  }

  return (
    <PageHeader
      bleed={bleed}
      backButton={{
        onClick: () => navigate('/patients'),
        label: 'Voltar para pacientes',
      }}
      title={
        <div className="flex items-start gap-3 sm:gap-4">
          <PatientAvatar name={patient.name} fotoUrl={patient.foto_url} size="lg" />
          <div className="min-w-0">
            <div className="flex flex-wrap items-center gap-2">
              <h1 className="font-serif text-xl font-medium tracking-tight text-charcoal sm:text-2xl md:text-3xl">
                {patient.name}
              </h1>
              <FamilyDiaryAlertButton count={diaryCount} onClick={onDiaryOpen} />
            </div>
            {patient.nome_social && (
              <p className="mt-0.5 text-sm text-charcoal-muted">Nome social: {patient.nome_social}</p>
            )}
          </div>
        </div>
      }
      subtitle={
        <div className="flex flex-wrap items-center gap-2">
          <span className="text-sm text-charcoal-muted">{age} anos</span>
          {patient.diagnoses.length > 0 && (
            <>
              <span className="text-charcoal-muted/30" aria-hidden>
                •
              </span>
              {patient.diagnoses.map((d, i) => (
                <span
                  key={i}
                  className="inline-flex rounded-full bg-primary-50 px-2.5 py-0.5 text-[11px] font-medium text-primary-700"
                >
                  {d}
                </span>
              ))}
            </>
          )}
        </div>
      }
      actions={
        <div className="flex w-full flex-wrap items-center justify-end gap-1.5 sm:w-auto sm:gap-2">
          <div className="hidden items-center gap-2 sm:flex">
            <PatientFamilyInviteButton onClick={onFamilyInvite} />
            <ExportPdfButton patientId={patient.id} patientName={patient.name} />
            <PatientLinkManageFlow
              patientId={patient.id}
              patientName={patient.name}
              statusVinculo={patient.status_vinculo}
            />
            <RecordSessionButton onClick={goRecordSession} />
            <button type="button" onClick={goCopilot} className={btnPrimary}>
              <SparkIcon className="h-3.5 w-3.5" />
              Copiloto IA
            </button>
          </div>

          <div className="flex w-full items-center justify-end gap-1.5 sm:hidden">
            <button
              type="button"
              onClick={onFamilyInvite}
              className={btnIcon}
              aria-label="Gerar acesso família"
              title="Gerar acesso família"
            >
              <svg className="h-4 w-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2} aria-hidden>
                <path strokeLinecap="round" strokeLinejoin="round" d="M16 7a4 4 0 11-8 0 4 4 0 018 0zM12 14a7 7 0 00-7 7h10m4-7v6m3-3h-6" />
              </svg>
            </button>
            <ExportPdfButton patientId={patient.id} patientName={patient.name} variant="icon" />
            <RecordSessionButton onClick={goRecordSession} variant="headerMobile" />
            <PatientLinkManageFlow
              patientId={patient.id}
              patientName={patient.name}
              statusVinculo={patient.status_vinculo}
            />
            <button type="button" onClick={goCopilot} className={`${btnPrimary} min-w-[7.5rem] flex-1`}>
              <SparkIcon className="h-3.5 w-3.5" />
              Copiloto IA
            </button>
          </div>
        </div>
      }
      tabs={
        <PatientRecordTabs
          active={activeTab}
          onChange={onTabChange}
          clinicalDirty={clinicalDirty}
          embedded
        />
      }
    />
  );
}
