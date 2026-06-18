import { SupabaseClient } from 'https://esm.sh/@supabase/supabase-js@2.45.0';
import { AppError } from '../_shared/errors.ts';
import type { ListAllReportsInput } from './schema.ts';
import type { ReportItem, ListAllReportsOutput } from './types.ts';

export async function listAllReports(
  supabase: SupabaseClient,
  professionalId: string,
  input: ListAllReportsInput,
): Promise<ListAllReportsOutput> {
  const { page, per_page, status, patient_id, search } = input;
  const offset = (page - 1) * per_page;

  // Build query for session_notes owned by this professional
  let query = supabase
    .from('session_notes')
    .select('id, patient_id, status, content, ai_generated, created_at, updated_at, approved_at', { count: 'exact' })
    .eq('professional_id', professionalId)
    .is('deleted_at', null)
    .order('created_at', { ascending: false })
    .range(offset, offset + per_page - 1);

  // Filter by status
  if (status !== 'all') {
    query = query.eq('status', status);
  }

  // Filter by patient
  if (patient_id) {
    query = query.eq('patient_id', patient_id);
  }

  const { data: notes, error: notesError, count } = await query;

  if (notesError) {
    throw new AppError({
      code: 'REPORTS_FETCH_FAILED',
      message: notesError.message,
      statusCode: 500,
    });
  }

  const total = count ?? 0;

  // Fetch patient names for the results
  const patientIds = [...new Set((notes ?? []).map((n) => n.patient_id))];
  const patientMap = new Map<string, string>();

  if (patientIds.length > 0) {
    const { data: patients } = await supabase
      .from('patients')
      .select('id, name')
      .in('id', patientIds);

    (patients ?? []).forEach((p) => patientMap.set(p.id, p.name));
  }

  // Assemble response
  let items: ReportItem[] = (notes ?? []).map((note) => ({
    id: note.id,
    patient_id: note.patient_id,
    patient_name: patientMap.get(note.patient_id) ?? 'Paciente',
    status: note.status,
    content: note.content,
    ai_generated: note.ai_generated,
    created_at: note.created_at,
    updated_at: note.updated_at,
    approved_at: note.approved_at,
  }));

  // Client-side search filter (by patient name) — simple approach for small datasets
  if (search && search.trim().length > 0) {
    const term = search.toLowerCase().trim();
    items = items.filter((item) => item.patient_name.toLowerCase().includes(term));
  }

  return {
    items,
    pagination: {
      page,
      per_page,
      total,
      total_pages: Math.ceil(total / per_page),
    },
  };
}
