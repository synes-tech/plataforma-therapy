import { createServiceClient } from './supabase.ts';
import { AppError } from './errors.ts';

/** 1 paciente gratuito durante trial sem cartão */
export const FREEMIUM_PATIENT_LIMIT = 1;

export interface ClinicBillingGate {
  subscription_status: string;
  payment_method_on_file: boolean;
}

export function requiresPaywall(billing: ClinicBillingGate): boolean {
  if (billing.payment_method_on_file) return false;
  if (billing.subscription_status === 'active') return false;
  if (billing.subscription_status === 'trial_active') return false;
  return true;
}

export async function getClinicBillingGate(clinicId: string): Promise<ClinicBillingGate> {
  const supabase = createServiceClient();

  const { data, error } = await supabase
    .from('clinics')
    .select('subscription_status, payment_method_on_file')
    .eq('id', clinicId)
    .is('deleted_at', null)
    .single();

  if (error || !data) {
    throw new AppError({
      code: 'CLINIC_NOT_FOUND',
      message: 'Clínica não encontrada',
      statusCode: 404,
    });
  }

  return {
    subscription_status: data.subscription_status as string,
    payment_method_on_file: Boolean(data.payment_method_on_file),
  };
}

/** Contagem head-only — apenas pacientes com vínculo ativo (ocupam cota do plano). */
export async function countActivePatientsForProfessional(professionalId: string): Promise<number> {
  const supabase = createServiceClient();

  const { count, error } = await supabase
    .from('patients')
    .select('id', { count: 'exact', head: true })
    .eq('professional_id', professionalId)
    .eq('status', 'active')
    .eq('status_vinculo', 'ativo')
    .is('deleted_at', null);

  if (error) {
    throw new AppError({
      code: 'PATIENT_COUNT_FAILED',
      message: 'Falha ao verificar limite de pacientes',
      statusCode: 500,
    });
  }

  return count ?? 0;
}

/** Pacientes desvinculados (arquivo / backup) do profissional. */
export async function countDesvinculadoPatientsForProfessional(professionalId: string): Promise<number> {
  const supabase = createServiceClient();

  const { count, error } = await supabase
    .from('patients')
    .select('id', { count: 'exact', head: true })
    .eq('professional_id', professionalId)
    .eq('status_vinculo', 'desvinculado')
    .is('deleted_at', null);

  if (error) {
    throw new AppError({
      code: 'BACKUP_COUNT_FAILED',
      message: 'Falha ao verificar pacientes em backup',
      statusCode: 500,
    });
  }

  return count ?? 0;
}

export async function getBackupPatientLicenses(clinicId: string): Promise<number> {
  const supabase = createServiceClient();

  const { data, error } = await supabase
    .from('clinics')
    .select('quantidade_backup_pacientes')
    .eq('id', clinicId)
    .is('deleted_at', null)
    .single();

  if (error || !data) {
    throw new AppError({
      code: 'CLINIC_NOT_FOUND',
      message: 'Clínica não encontrada',
      statusCode: 404,
    });
  }

  return Number(data.quantidade_backup_pacientes ?? 0);
}

/** Valida licença de backup antes de desvincular (upsell = 402). */
export async function assertCanUnlinkToBackup(
  clinicId: string,
  professionalId: string,
): Promise<void> {
  const licenses = await getBackupPatientLicenses(clinicId);

  if (licenses === 0) {
    throw paymentRequired(
      'Contrate o Backup de Paciente para manter o histórico clínico ao desvincular.',
    );
  }

  const inUse = await countDesvinculadoPatientsForProfessional(professionalId);
  if (inUse >= licenses) {
    throw new AppError({
      code: 'BACKUP_QUOTA_EXCEEDED',
      message:
        'Todas as licenças de Backup estão em uso. Contrate add-ons ou exclua permanentemente um paciente arquivado.',
      statusCode: 403,
    });
  }
}

/** @deprecated use assertCanUnlinkToBackup */
export async function assertWithinBackupQuota(
  clinicId: string,
  professionalId: string,
): Promise<void> {
  await assertCanUnlinkToBackup(clinicId, professionalId);
}

function paymentRequired(message: string): AppError {
  return new AppError({
    code: 'PAYMENT_REQUIRED',
    message,
    statusCode: 402,
  });
}

export async function assertCanCreatePatientPaywall(
  clinicId: string,
  professionalId: string,
): Promise<void> {
  const billing = await getClinicBillingGate(clinicId);
  if (!requiresPaywall(billing)) return;

  const patientCount = await countActivePatientsForProfessional(professionalId);
  if (patientCount >= FREEMIUM_PATIENT_LIMIT) {
    throw paymentRequired(
      'Desbloqueie o poder total da Unithery. Inicie seus 14 dias grátis agora.',
    );
  }
}

export async function assertCanUseAiPaywall(clinicId: string): Promise<void> {
  const billing = await getClinicBillingGate(clinicId);
  if (requiresPaywall(billing)) {
    throw paymentRequired(
      'Desbloqueie o poder total da Unithery. Inicie seus 14 dias grátis agora.',
    );
  }
}
