export interface ScheduleLifecycleRow {
  id: string;
  status: string;
  scheduled_at: string;
  duration_minutes: number;
  started_at: string | null;
  completed_at: string | null;
  session_note_id: string | null;
}

export function scheduleEndMs(row: Pick<ScheduleLifecycleRow, 'scheduled_at' | 'duration_minutes'>): number {
  const duration = row.duration_minutes ?? 50;
  return new Date(row.scheduled_at).getTime() + duration * 60_000;
}

/** Status efetivo para exibição (concluído, em andamento, não concluído, etc.). */
export function resolveEffectiveScheduleStatus(row: ScheduleLifecycleRow, now = Date.now()): string {
  if (row.status === 'cancelled') return 'cancelled';
  if (row.status === 'no_show') return 'no_show';
  if (row.status === 'completed' || row.completed_at) return 'completed';
  if (row.status === 'not_completed') return 'not_completed';

  const endMs = scheduleEndMs(row);
  if (now > endMs) return 'not_completed';

  if (row.started_at || row.status === 'in_progress') return 'in_progress';
  return 'scheduled';
}

/** Persiste status not_completed quando passou o horário sem conclusão. */
export function shouldPersistNotCompleted(row: ScheduleLifecycleRow, now = Date.now()): boolean {
  if (['cancelled', 'no_show', 'completed', 'not_completed'].includes(row.status)) return false;
  if (row.completed_at) return false;
  return now > scheduleEndMs(row);
}
