import type { ReactNode } from 'react';
import { ProactiveSummaryPanel } from '@features/patient-record/ProactiveSummaryPanel';
import { SessionTimeline } from '@features/patient-record/SessionTimeline';
import { DiaryOverview } from '@features/patient-record/DiaryOverview';
import { ClinicalReturnRecorder } from '@features/patient-record/ClinicalReturnRecorder';
import { SessionRecommendationsPanel } from './SessionRecommendationsPanel';
import { RecordEmptyState } from './RecordEmptyState';
import type { DiaryEntry, EvolutionWeek, PatientInfo, SessionNote, UpcomingSession } from './patient-record.types';

interface PatientOverviewTabProps {
  patientId: string;
  patient: PatientInfo;
  sessionNotes: SessionNote[];
  recentDiary: DiaryEntry[];
  evolution: EvolutionWeek[];
  upcomingSessions: UpcomingSession[];
  totalSessions: number;
}

function OverviewSideCard({
  title,
  subtitle,
  children,
}: {
  title: string;
  subtitle?: string;
  children: ReactNode;
}) {
  return (
    <div className="rounded-2xl border border-slate-100 bg-white p-4 shadow-sm lg:p-6">
      <h3 className="text-xs font-semibold uppercase tracking-wide text-charcoal-muted">{title}</h3>
      {subtitle && <p className="mt-0.5 text-[10px] text-charcoal-muted/60">{subtitle}</p>}
      <div className="mt-4">{children}</div>
    </div>
  );
}

export function PatientOverviewTab({
  patientId,
  patient,
  sessionNotes,
  recentDiary,
  evolution,
  upcomingSessions,
  totalSessions,
}: PatientOverviewTabProps) {
  const diaryBlock =
    recentDiary.length > 0 ? (
      <DiaryOverview entries={recentDiary} />
    ) : (
      <div className="rounded-2xl border border-slate-100 bg-white p-4 shadow-sm lg:p-6">
        <RecordEmptyState variant="diary" />
      </div>
    );

  const timelineBlock =
    sessionNotes.length > 0 ? (
      <SessionTimeline notes={sessionNotes} totalSessions={totalSessions} />
    ) : (
      <div className="rounded-2xl border border-slate-100 bg-white p-4 shadow-sm lg:p-6">
        <RecordEmptyState variant="sessions" />
      </div>
    );

  return (
    <div className="grid grid-cols-1 gap-4 pb-10 lg:grid-cols-12 lg:gap-6 lg:pb-4">
      {/* 1 — Gravador (mobile: topo / polegar) · desktop: coluna direita */}
      <div className="order-1 lg:col-span-4 lg:col-start-9 lg:row-start-1">
        <ClinicalReturnRecorder patientId={patientId} patientName={patient.name} />
      </div>

      {/* 2 — Resumo proativo · desktop: coluna principal */}
      <div className="order-2 lg:col-span-8 lg:row-start-1">
        <ProactiveSummaryPanel
          patientId={patientId}
          totalSessions={totalSessions}
          hasClinicalObservations={!!patient.clinical_observations?.trim()}
        />
      </div>

      {/* 3 — Diário familiar */}
      <div className="order-3 lg:col-span-4 lg:col-start-9 lg:row-start-2">
        {diaryBlock}
      </div>

      {/* 4 — Ações recomendadas */}
      <div className="order-4 lg:col-span-8 lg:row-start-2">
        <SessionRecommendationsPanel patientId={patientId} />
      </div>

      {/* 5 — Histórico de sessões */}
      <div className="order-5 lg:col-span-8 lg:row-start-3">
        {timelineBlock}
      </div>

      {/* 6 — Metadados laterais */}
      {(evolution.length > 0 || upcomingSessions.length > 0 || patient.clinical_observations) && (
        <div className="order-6 flex flex-col gap-4 lg:col-span-4 lg:col-start-9 lg:row-start-3">
          {evolution.length > 0 && (
            <OverviewSideCard title="Evolução Semanal">
              <div className="space-y-3">
                {evolution.slice(0, 4).map((week) => (
                  <div key={week.week_start} className="flex items-center justify-between text-xs">
                    <span className="text-charcoal-muted">
                      {new Date(week.week_start).toLocaleDateString('pt-BR', {
                        day: '2-digit',
                        month: 'short',
                      })}
                    </span>
                    <div className="flex items-center gap-3">
                      <span className="text-charcoal">😊 {week.avg_mood}</span>
                      <span className="text-charcoal">💤 {week.avg_sleep}</span>
                      {week.crisis_count > 0 && (
                        <span className="text-error">⚠ {week.crisis_count}</span>
                      )}
                    </div>
                  </div>
                ))}
              </div>
            </OverviewSideCard>
          )}

          {upcomingSessions.length > 0 && (
            <OverviewSideCard title="Próximas Sessões">
              <div className="space-y-2">
                {upcomingSessions.map((session) => (
                  <div key={session.id} className="flex items-center justify-between text-xs">
                    <span className="font-medium text-charcoal">
                      {new Date(session.scheduled_at).toLocaleDateString('pt-BR', {
                        weekday: 'short',
                        day: '2-digit',
                        month: 'short',
                      })}
                    </span>
                    <span className="text-charcoal-muted">
                      {new Date(session.scheduled_at).toLocaleTimeString('pt-BR', {
                        hour: '2-digit',
                        minute: '2-digit',
                      })}
                      {' · '}
                      {session.duration_minutes}min
                    </span>
                  </div>
                ))}
              </div>
            </OverviewSideCard>
          )}

          {patient.clinical_observations && (
            <OverviewSideCard title="Observações Clínicas">
              <p className="text-sm leading-relaxed text-charcoal-muted">
                {patient.clinical_observations}
              </p>
            </OverviewSideCard>
          )}
        </div>
      )}
    </div>
  );
}
