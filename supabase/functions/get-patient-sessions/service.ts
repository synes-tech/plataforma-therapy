import { createServiceClient } from '../_shared/supabase.ts';
import { AppError } from '../_shared/errors.ts';
import { verifyPatientAccess } from '../_shared/verify-patient-access.ts';
import type { AuthenticatedUser } from '../_shared/auth.ts';
import type {
  GetPatientSessionsPayload,
  GetPatientSessionsResponse,
  PatientSessionItem,
  SessionSoapContent,
} from './types.ts';

const DEFAULT_PAGE_SIZE = 10;
const MAX_PAGE_SIZE = 50;

const SESSION_SELECT = `
  id,
  patient_id,
  created_at,
  status,
  content,
  audio_recordings (
    storage_path,
    mime_type,
    duration_seconds
  ),
  audio_transcriptions (
    raw_text
  )
`;

function normalizeSoapContent(raw: unknown): SessionSoapContent {
  const obj = (raw && typeof raw === 'object' ? raw : {}) as Record<string, unknown>;
  return {
    subjective: String(obj.subjective ?? ''),
    objective: String(obj.objective ?? ''),
    assessment: String(obj.assessment ?? ''),
    plan: String(obj.plan ?? ''),
    summary_markdown: obj.summary_markdown ? String(obj.summary_markdown) : undefined,
    transcription: obj.transcription ? String(obj.transcription) : undefined,
  };
}

interface SessionRow {
  id: string;
  patient_id: string;
  created_at: string;
  status: string;
  content: unknown;
  audio_recordings: {
    storage_path: string;
    mime_type: string | null;
    duration_seconds: number | null;
  } | null;
  audio_transcriptions: {
    raw_text: string;
  } | null;
}

export async function getPatientSessions(
  payload: GetPatientSessionsPayload,
  caller: AuthenticatedUser,
): Promise<GetPatientSessionsResponse> {
  const supabase = createServiceClient();
  await verifyPatientAccess(payload.patient_id, caller);

  const page = payload.page ?? 1;
  const pageSize = Math.min(payload.page_size ?? DEFAULT_PAGE_SIZE, MAX_PAGE_SIZE);
  const from = (page - 1) * pageSize;
  const to = from + pageSize - 1;

  const { count, error: countError } = await supabase
    .from('session_notes')
    .select('id', { count: 'exact', head: true })
    .eq('patient_id', payload.patient_id)
    .is('deleted_at', null);

  if (countError) {
    throw new AppError({
      code: 'SESSIONS_COUNT_FAILED',
      message: countError.message,
      statusCode: 500,
    });
  }

  const { data, error } = await supabase
    .from('session_notes')
    .select(SESSION_SELECT)
    .eq('patient_id', payload.patient_id)
    .is('deleted_at', null)
    .order('created_at', { ascending: false })
    .range(from, to);

  if (error) {
    throw new AppError({
      code: 'SESSIONS_LIST_FAILED',
      message: error.message,
      statusCode: 500,
    });
  }

  const totalCount = count ?? 0;
  const rows = (data ?? []) as SessionRow[];

  const items: PatientSessionItem[] = rows.map((row) => ({
    id: row.id,
    paciente_id: row.patient_id,
    data_sessao: row.created_at,
    status_nota: row.status,
    audio_url: row.audio_recordings?.storage_path ?? null,
    audio_mime_type: row.audio_recordings?.mime_type ?? null,
    audio_duracao_segundos: row.audio_recordings?.duration_seconds ?? null,
    transcricao_completa: row.audio_transcriptions?.raw_text ?? null,
    resumo_ia: normalizeSoapContent(row.content),
  }));

  return {
    items,
    page,
    page_size: pageSize,
    total_count: totalCount,
    has_more: from + items.length < totalCount,
  };
}
