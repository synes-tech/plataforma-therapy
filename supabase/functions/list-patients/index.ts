import { serve } from 'https://deno.land/std@0.224.0/http/server.ts';
import { handleCors } from '../_shared/cors.ts';
import { successResponse, errorResponse } from '../_shared/response.ts';
import { authenticateRequest, requireRole } from '../_shared/auth.ts';
import { createServiceClient } from '../_shared/supabase.ts';
import { attachFamilyLinkStatus } from '../_shared/patient-family-link-status.ts';
import { buildPatientSearchOrFilter, normalizePatientSearchTerm } from '../_shared/patient-search.ts';
import { AppError, ValidationError } from '../_shared/errors.ts';
import { ListPatientsSchema } from './schema.ts';

const PATIENT_SELECT =
  'id, name, birth_date, diagnoses, status, status_vinculo, created_at, foto_url, cpf_paciente, cpf_responsavel, nome_responsavel';

serve(async (req: Request) => {
  const corsResponse = handleCors(req);
  if (corsResponse) return corsResponse;

  try {
    const user = await authenticateRequest(req);
    requireRole(user, ['professional', 'clinic_admin', 'master']);

    let searchQuery: string | undefined;
    if (req.method === 'POST') {
      const body = await req.json().catch(() => ({}));
      const parsed = ListPatientsSchema.safeParse(body);
      if (!parsed.success) {
        return errorResponse(new ValidationError(parsed.error.flatten().fieldErrors), req);
      }
      searchQuery = parsed.data.q?.trim() || undefined;
    }

    const supabase = createServiceClient();

    const { data: professional } = await supabase
      .from('professionals')
      .select('id, clinic_id')
      .eq('user_id', user.id)
      .is('deleted_at', null)
      .single();

    if (!professional) {
      const { data: adminRecord } = await supabase
        .from('clinic_admins')
        .select('clinic_id')
        .eq('user_id', user.id)
        .is('deleted_at', null)
        .single();

      if (!adminRecord) {
        throw new AppError({ code: 'NO_ACCESS', message: 'Sem acesso a pacientes', statusCode: 403 });
      }

      let query = supabase
        .from('patients')
        .select(PATIENT_SELECT)
        .eq('clinic_id', adminRecord.clinic_id)
        .eq('status_vinculo', 'ativo')
        .is('deleted_at', null)
        .order('created_at', { ascending: false });

      if (searchQuery) {
        const { term, isCpf, cpfDigits } = normalizePatientSearchTerm(searchQuery);
        query = query.or(buildPatientSearchOrFilter(term, isCpf, cpfDigits));
      }

      const { data: patients, error } = await query;
      if (error) throw new AppError({ code: 'FETCH_FAILED', message: error.message, statusCode: 500 });
      const enriched = await attachFamilyLinkStatus(supabase, patients ?? []);
      return successResponse(enriched, req, 200);
    }

    let query = supabase
      .from('patients')
      .select(PATIENT_SELECT)
      .eq('professional_id', professional.id)
      .eq('status_vinculo', 'ativo')
      .is('deleted_at', null)
      .order('created_at', { ascending: false });

    if (searchQuery) {
      const { term, isCpf, cpfDigits } = normalizePatientSearchTerm(searchQuery);
      query = query.or(buildPatientSearchOrFilter(term, isCpf, cpfDigits));
    }

    const { data: patients, error } = await query;

    if (error) {
      throw new AppError({ code: 'FETCH_FAILED', message: error.message, statusCode: 500 });
    }

    const enriched = await attachFamilyLinkStatus(supabase, patients ?? []);
    return successResponse(enriched, req, 200);
  } catch (error) {
    return errorResponse(error, req);
  }
});
