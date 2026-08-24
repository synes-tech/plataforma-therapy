import { useRef } from 'react';
import { useNavigate } from 'react-router-dom';
import { PageHeader } from '@containers/layout';
import { sessionWorkspacePath } from '@containers/session-workspace/session-workspace.utils';
import { MobileActionsMenu } from '@shared/ui/MobileActionsMenu';
import { PatientAvatar } from './PatientAvatar';
import { FamilyDiaryAlertButton } from './family-diary/FamilyDiaryAlertButton';
import { PatientFamilyInviteButton } from './PatientFamilyInvite';
import { PatientLinkManageFlow } from './PatientLinkManageFlow';
import { RecordSessionButton } from './RecordSessionButton';
import type { PatientInfo } from './patient-record.types';

interface PatientRecordPageHeaderProps {
  patient: PatientInfo;
  age: number;
  diaryCount: number;
  onDiaryOpen: () => void;
  onFamilyInvite: () => void;
  bleed?: boolean;
}

export function PatientRecordPageHeader({
  patient,
  age,
  diaryCount,
  onDiaryOpen,
  onFamilyInvite,
  bleed = true,
}: PatientRecordPageHeaderProps) {
  const navigate = useNavigate();
  const openLinkManageRef = useRef<(() => void) | null>(null);

  function goRecordSession() {
    navigate(sessionWorkspacePath(patient.id));
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
      label: 'Iniciar sessão',
      onClick: goRecordSession,
      variant: 'primary' as const,
    },
  ];

  return (
    <PageHeader
      bleed={bleed}
      title={
        <div className="flex items-center gap-3 sm:gap-4">
          <span className="lg:hidden">
            <PatientAvatar name={patient.name} fotoUrl={patient.foto_url} size="lg" />
          </span>
          <span className="hidden lg:inline-flex">
            <PatientAvatar name={patient.name} fotoUrl={patient.foto_url} size="sm" />
          </span>
          <div className="min-w-0">
            <div className="flex flex-wrap items-center gap-2">
              <h1 className="truncate font-serif text-xl font-medium tracking-tight text-charcoal sm:text-2xl lg:font-display lg:text-[20px] lg:font-semibold lg:leading-none lg:tracking-tight">
                {patient.name}
              </h1>
              <FamilyDiaryAlertButton count={diaryCount} onClick={onDiaryOpen} />
            </div>
            {patient.nome_social ? (
              <p className="mt-0.5 text-sm text-charcoal-muted lg:hidden">Nome social: {patient.nome_social}</p>
            ) : null}
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
          </div>

          <MobileActionsMenu
            items={mobileActions}
            className="w-full sm:w-auto"
            dataTour="cta-patient-actions"
          />
        </div>
      }
    />
  );
}
