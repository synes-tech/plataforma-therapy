import { createServiceClient } from '../_shared/supabase.ts';
import { AppError } from '../_shared/errors.ts';
import type { AuthenticatedUser } from '../_shared/auth.ts';
import { assertFamilyOwnsPatient } from '../_shared/family-access.ts';
import { parseProactiveSummaryForFamily } from '../_shared/family-summary.ts';

export interface AgreementItem {
  id: string;
  title: string;
  description: string | null;
  status: 'pending' | 'done';
  completed_at: string | null;
  created_at: string;
}

export interface LatestAgreementsResponse {
  patient_id: string;
  patient_name: string;
  last_session: {
    date: string;
    summary_for_family: string;
    plan_highlight: string;
  } | null;
  attention_points: string[];
  activity_suggestions: string[];
  clinical_summary: string;
  summary_updated_at: string | null;
  agreements: AgreementItem[];
}

function familySessionSummary(subjective: string, assessment: string): string {
  const text = subjective.trim() || assessment.trim();
  if (!text) return 'O terapeuta ainda não registrou um resumo detalhado desta sessão.';
  return text.length > 400 ? `${text.slice(0, 397)}...` : text;
}

export async function getLatestAgreements(
  payload: { patient_id?: string },
  caller: AuthenticatedUser,
): Promise<LatestAgreementsResponse> {
  const link = await assertFamilyOwnsPatient(caller.id, payload.patient_id);
  const supabase = createServiceClient();

  const { data: briefRaw, error: briefError } = await supabase.rpc('get_family_session_brief', {
    p_user_id: caller.id,
  });

  if (briefError) {
    throw new AppError({ code: 'BRIEF_FETCH_FAILED', message: briefError.message, statusCode: 500 });
  }

  const brief = briefRaw as {
    found: boolean;
    last_session?: {
      date: string;
      subjective: string;
      plan: string;
      assessment: string;
    } | null;
    proactive_summary?: { markdown: string; updated_at: string } | null;
  };

  const { data: agreements, error: agrError } = await supabase
    .from('agreements')
    .select('id, title, description, status, completed_at, created_at')
    .eq('patient_id', link.patient_id)
    .is('deleted_at', null)
    .order('status', { ascending: true })
    .order('created_at', { ascending: false })
    .limit(20);

  if (agrError) {
    throw new AppError({ code: 'FETCH_FAILED', message: agrError.message, statusCode: 500 });
  }

  let attention_points: string[] = [];
  let activity_suggestions: string[] = [];
  let clinical_summary = '';
  let summary_updated_at: string | null = null;

  if (brief?.proactive_summary?.markdown) {
    const parsed = parseProactiveSummaryForFamily(brief.proactive_summary.markdown);
    attention_points = parsed.attention_points;
    activity_suggestions = parsed.activity_suggestions;
    clinical_summary = parsed.clinical_summary;
    summary_updated_at = brief.proactive_summary.updated_at;
  }

  const lastSession = brief?.last_session
    ? {
        date: brief.last_session.date,
        summary_for_family: familySessionSummary(
          brief.last_session.subjective,
          brief.last_session.assessment,
        ),
        plan_highlight: brief.last_session.plan.trim()
          ? (brief.last_session.plan.length > 300
            ? `${brief.last_session.plan.slice(0, 297)}...`
            : brief.last_session.plan)
          : 'Sem combinados específicos registrados nesta sessão.',
      }
    : null;

  return {
    patient_id: link.patient_id,
    patient_name: link.patient_name,
    last_session: lastSession,
    attention_points,
    activity_suggestions,
    clinical_summary,
    summary_updated_at,
    agreements: (agreements ?? []) as AgreementItem[],
  };
}
