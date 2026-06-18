import { createServiceClient } from '../_shared/supabase.ts';
import {
  countDesvinculadoPatientsForProfessional,
  getBackupPatientLicenses,
} from '../_shared/paywall.ts';
import { AppError } from '../_shared/errors.ts';
import type { AuthenticatedUser } from '../_shared/auth.ts';
import type { ArchivedPatientRow, GetArchivedPatientsResponse } from './types.ts';

const PATIENT_SELECT =
  'id, name, birth_date, diagnoses, cpf, foto_url, status_vinculo, created_at, data_desvinculacao';

async function countDesvinculadoForClinic(clinicId: string): Promise<number> {
  const supabase = createServiceClient();

  const { count, error } = await supabase
    .from('patients')
    .select('id', { count: 'exact', head: true })
    .eq('clinic_id', clinicId)
    .eq('status_vinculo', 'desvinculado')
    .is('deleted_at', null);

  if (error) {
    throw new AppError({
      code: 'BACKUP_COUNT_FAILED',
      message: 'Falha ao verificar pacientes arquivados',
      statusCode: 500,
    });
  }

  return count ?? 0;
}

export async function getArchivedPatients(
  caller: AuthenticatedUser,
): Promise<GetArchivedPatientsResponse> {
  const supabase = createServiceClient();

  const { data: professional } = await supabase
    .from('professionals')
    .select('id, clinic_id')
    .eq('user_id', caller.id)
    .is('deleted_at', null)
    .maybeSingle();

  let patients: ArchivedPatientRow[] = [];
  let archivedCount = 0;
  let clinicId: string;

  if (professional) {
    clinicId = professional.clinic_id as string;

    const { data, error } = await supabase
      .from('patients')
      .select(PATIENT_SELECT)
      .eq('professional_id', professional.id)
      .eq('status_vinculo', 'desvinculado')
      .is('deleted_at', null)
      .order('created_at', { ascending: false });

    if (error) {
      throw new AppError({
        code: 'FETCH_FAILED',
        message: error.message,
        statusCode: 500,
      });
    }

    patients = (data ?? []) as ArchivedPatientRow[];
    archivedCount = await countDesvinculadoPatientsForProfessional(professional.id);
  } else {
    const { data: adminRecord } = await supabase
      .from('clinic_admins')
      .select('clinic_id')
      .eq('user_id', caller.id)
      .is('deleted_at', null)
      .maybeSingle();

    if (!adminRecord) {
      throw new AppError({
        code: 'NO_ACCESS',
        message: 'Sem acesso a pacientes arquivados',
        statusCode: 403,
      });
    }

    clinicId = adminRecord.clinic_id as string;

    const { data, error } = await supabase
      .from('patients')
      .select(PATIENT_SELECT)
      .eq('clinic_id', clinicId)
      .eq('status_vinculo', 'desvinculado')
      .is('deleted_at', null)
      .order('created_at', { ascending: false });

    if (error) {
      throw new AppError({
        code: 'FETCH_FAILED',
        message: error.message,
        statusCode: 500,
      });
    }

    patients = (data ?? []) as ArchivedPatientRow[];
    archivedCount = await countDesvinculadoForClinic(clinicId);
  }

  const quantidade_backup_pacientes = await getBackupPatientLicenses(clinicId);

  return {
    patients,
    quantidade_backup_pacientes,
    archived_count: archivedCount,
  };
}
