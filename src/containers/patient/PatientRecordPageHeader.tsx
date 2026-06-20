import { useRef } from 'react';
import { useNavigate } from 'react-router-dom';
import { PageHeader } from '@containers/layout';
import { MobileActionsMenu } from '@shared/ui/MobileActionsMenu';
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
  const openLinkManageRef = useRef<(() => void) | null>(null);

  function goCopilot() {
    if (activeTab !== 'copilot') onTabChange('copilot');
  }

  function goRecordSession() {
    navigate(`/session/${patient.id}`);
  }

  const mobileActions = [
    {
      id: 'family',
      label: 'Gerar acesso família',
      onClick: onFamilyInvite,
    },
    ...(patient.status_vinculo === 'ativo'
      ? [
          {
            id: 'link',
            label: 'Gerenciar o vínculo',
            onClick: () => openLinkManageRef.current?.(),
          },
        ]
      : []),
    {
      id: 'record',
      label: 'Gravar sessão',
      onClick: goRecordSession,
    },
    {
      id: 'copilot',
      label: 'Copiloto IA',
      onClick: goCopilot,
      variant: 'primary' as const,
      icon: <SparkIcon className="h-4 w-4" />,
    },
  ];

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
            <PatientLinkManageFlow
              patientId={patient.id}
              patientName={patient.name}
              statusVinculo={patient.status_vinculo}
              triggerVisibility="desktop"
              onReady={(handlers) => {
                openLinkManageRef.current = handlers.openManage;
              }}
            />
            <RecordSessionButton onClick={goRecordSession} />
            <button type="button" onClick={goCopilot} className={btnPrimary}>
              <SparkIcon className="h-3.5 w-3.5" />
              Copiloto IA
            </button>
          </div>

          <MobileActionsMenu items={mobileActions} className="w-full sm:w-auto" />
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
