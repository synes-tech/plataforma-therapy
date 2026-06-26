import { createServiceClient } from '../_shared/supabase.ts';
import { AppError } from '../_shared/errors.ts';
import { assertFamilyOwnsPatient } from '../_shared/family-access.ts';
import {
  buildFamilyReportPreview,
  extractFamilyReportText,
} from '../_shared/family-session-report.ts';
import type { AuthenticatedUser } from '../_shared/auth.ts';
import type {
  FamilySessionHistoryItem,
  GetFamilySessionHistoryPayload,
  GetFamilySessionHistoryResponse,
} from './types.ts';

const DEFAULT_PAGE_SIZE = 10;
const MAX_PAGE_SIZE = 50;

function formatSessionTime(iso: string): string {
  return new Intl.DateTimeFormat('pt-BR', {
    hour: '2-digit',
    minute: '2-digit',
    timeZone: 'America/Sao_Paulo',
  }).format(new Date(iso));
}

interface SessionRow {
  id: string;
  created_at: string;
  status: string;
  visivel_familia: boolean;
  content: unknown;
  professionals: { name: string } | null;
}

export async function getFamilySessionHistory(
  payload: GetFamilySessionHistoryPayload,
  caller: AuthenticatedUser,
): Promise<GetFamilySessionHistoryResponse> {
  const link = await assertFamilyOwnsPatient(caller.id, payload.patient_id);
  const supabase = createServiceClient();

  const page = payload.page ?? 1;
  const pageSize = Math.min(payload.page_size ?? DEFAULT_PAGE_SIZE, MAX_PAGE_SIZE);
  const from = (page - 1) * pageSize;
  const to = from + pageSize - 1;

  const { count, error: countError } = await supabase
    .from('session_notes')
    .select('id', { count: 'exact', head: true })
    .eq('patient_id', link.patient_id)
    .eq('status', 'approved')
    .is('deleted_at', null);

  if (countError) {
    throw new AppError({ code: 'SESSIONS_COUNT_FAILED', message: countError.message, statusCode: 500 });
  }

  const { data, error } = await supabase
    .from('session_notes')
    .select('id, created_at, status, visivel_familia, content, professionals(name)')
    .eq('patient_id', link.patient_id)
    .eq('status', 'approved')
    .is('deleted_at', null)
    .order('created_at', { ascending: false })
    .range(from, to);

  if (error) {
    throw new AppError({ code: 'SESSIONS_LIST_FAILED', message: error.message, statusCode: 500 });
  }

  const totalCount = count ?? 0;
  const rows = (data ?? []) as SessionRow[];

  const items: FamilySessionHistoryItem[] = rows.map((row) => {
    const reportShared = row.visivel_familia === true;
    const familyText = reportShared ? extractFamilyReportText(row.content) : '';
    return {
      id: row.id,
      data_sessao: row.created_at,
      horario_sessao: formatSessionTime(row.created_at),
      therapist_name: row.professionals?.name ?? 'Profissional',
      status_nota: row.status,
      report_shared: reportShared,
      report_preview: reportShared && familyText ? buildFamilyReportPreview(familyText) : null,
    };
  });

  return {
    patient_id: link.patient_id,
    patient_name: link.patient_name,
    items,
    page,
    page_size: pageSize,
    total_count: totalCount,
    has_more: from + items.length < totalCount,
  };
}
