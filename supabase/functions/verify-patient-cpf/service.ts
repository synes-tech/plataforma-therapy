import { createServiceClient } from '../_shared/supabase.ts';
import { isValidCpfFormat, maskPatientName, normalizeCpf } from '../_shared/cpf.ts';
import { AppError, ValidationError } from '../_shared/errors.ts';
import type { AuthenticatedUser } from '../_shared/auth.ts';
import type { VerifyPatientCpfPayload, VerifyPatientCpfResponse } from './types.ts';

export async function verifyPatientCpf(
  payload: VerifyPatientCpfPayload,
  caller: AuthenticatedUser,
): Promise<VerifyPatientCpfResponse> {
  const cpf = normalizeCpf(payload.cpf);

  if (!isValidCpfFormat(cpf)) {
    throw new ValidationError({ cpf: 'CPF inválido' });
  }

  const supabase = createServiceClient();

  if (caller.role === 'professional') {
    const { data: professional } = await supabase
      .from('professionals')
      .select('id')
      .eq('user_id', caller.id)
      .is('deleted_at', null)
      .single();

    if (!professional) {
      throw new AppError({ code: 'NOT_A_PROFESSIONAL', message: 'Profissional não encontrado', statusCode: 403 });
    }

    const { data: patient, error } = await supabase
      .from('patients')
      .select('id, name, birth_date, status_vinculo, data_desvinculacao')
      .eq('professional_id', professional.id)
      .eq('cpf', cpf)
      .is('deleted_at', null)
      .maybeSingle();

    if (error) {
      throw new AppError({ code: 'CPF_LOOKUP_FAILED', message: error.message, statusCode: 500 });
    }

    if (!patient) return { exists: false };

    return {
      exists: true,
      patient_id: patient.id,
      name_masked: maskPatientName(patient.name as string),
      birth_date: patient.birth_date as string,
      status_vinculo: patient.status_vinculo as 'ativo' | 'desvinculado',
      data_desvinculacao: (patient.data_desvinculacao as string | null) ?? null,
    };
  }

  if (caller.role === 'clinic_admin') {
    if (!caller.clinic_id) {
      throw new AppError({ code: 'NO_CLINIC', message: 'Clínica não associada', statusCode: 403 });
    }

    const { data: patient, error } = await supabase
      .from('patients')
      .select('id, name, birth_date, status_vinculo, data_desvinculacao')
      .eq('clinic_id', caller.clinic_id)
      .eq('cpf', cpf)
      .is('deleted_at', null)
      .maybeSingle();

    if (error) {
      throw new AppError({ code: 'CPF_LOOKUP_FAILED', message: error.message, statusCode: 500 });
    }

    if (!patient) return { exists: false };

    return {
      exists: true,
      patient_id: patient.id,
      name_masked: maskPatientName(patient.name as string),
      birth_date: patient.birth_date as string,
      status_vinculo: patient.status_vinculo as 'ativo' | 'desvinculado',
      data_desvinculacao: (patient.data_desvinculacao as string | null) ?? null,
    };
  }

  throw new AppError({ code: 'FORBIDDEN', message: 'Perfil sem permissão para verificar CPF', statusCode: 403 });
}
