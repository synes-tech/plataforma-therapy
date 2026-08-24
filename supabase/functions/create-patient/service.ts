import { createServiceClient } from '../_shared/supabase.ts';
import { assertCanAddPatient } from '../_shared/plan-quotas.ts';
import { assertCanCreatePatientPaywall } from '../_shared/paywall.ts';
import { anamnesisToDbRow } from '../_shared/patient-anamnesis-schema.ts';
import { AppError, ValidationError } from '../_shared/errors.ts';
import type { AuthenticatedUser } from '../_shared/auth.ts';
import { contractFromCreatePayload, upsertFinancialContract } from '../_shared/financeiro-contract.ts';
import {
  type ClinicalModule,
  defaultAutonomyForProfile,
  deriveProfileType,
  normalizeModules,
  resolveInviteRouting,
} from '../_shared/patient-profile.ts';
import { sendPortalInviteEmail } from '../_shared/invite-email.ts';
import type { CreatePatientPayload, CreatePatientResponse } from './types.ts';

/**
 * Resolve os módulos clínicos do paciente.
 *
 * Quando o terapeuta não escolhe explicitamente, a própria taxonomia decide: um paciente
 * com TEA ou TDAH ganha o módulo de neurodesenvolvimento sem ninguém precisar marcar uma
 * caixinha. O módulo é incluso em todos os planos, então ativar por inferência não gera
 * cobrança nem surpresa comercial.
 */
async function resolveModules(
  supabase: ReturnType<typeof createServiceClient>,
  explicit: string[] | undefined,
  conditionIds: string[],
): Promise<ClinicalModule[]> {
  if (explicit && explicit.length > 0) return normalizeModules(explicit);
  if (conditionIds.length === 0) return normalizeModules([]);

  const { data } = await supabase
    .from('clinical_taxonomy')
    .select('suggested_modules')
    .in('id', conditionIds);

  const suggested = (data ?? []).flatMap(
    (row) => (row.suggested_modules as string[] | null) ?? [],
  );
  return normalizeModules(suggested);
}

/** Rejeita IDs de taxonomia inexistentes ou desativados antes de abrir a transação. */
async function assertConditionsExist(
  supabase: ReturnType<typeof createServiceClient>,
  conditionIds: string[],
): Promise<void> {
  if (conditionIds.length === 0) return;

  const { data } = await supabase
    .from('clinical_taxonomy')
    .select('id')
    .in('id', conditionIds)
    .eq('active', true);

  const found = new Set((data ?? []).map((row) => row.id as string));
  const missing = conditionIds.filter((id) => !found.has(id));

  if (missing.length > 0) {
    throw new ValidationError({
      condition_ids: [`Condição clínica desconhecida: ${missing.join(', ')}`],
    });
  }
}

export async function createPatient(
  payload: CreatePatientPayload,
  caller: AuthenticatedUser,
  _token: string,
): Promise<CreatePatientResponse> {
  const supabase = createServiceClient();

  const { data: professional } = await supabase
    .from('professionals')
    .select('id, clinic_id, name')
    .eq('user_id', caller.id)
    .is('deleted_at', null)
    .single();

  if (!professional) {
    throw new AppError({ code: 'NOT_A_PROFESSIONAL', message: 'O usuário não é um profissional registrado.', statusCode: 403 });
  }

  const clinicId = professional.clinic_id;

  await assertCanCreatePatientPaywall(clinicId, professional.id);
  await assertCanAddPatient(clinicId, professional.id);

  const cpf_paciente = payload.possui_cpf_proprio ? payload.cpf_paciente : null;
  const cpf_responsavel = payload.possui_cpf_proprio ? null : payload.cpf_responsavel;
  const nome_responsavel = payload.possui_cpf_proprio ? null : payload.nome_responsavel;

  const anamnesis = anamnesisToDbRow(payload);

  // O perfil declarado já foi conferido contra a data de nascimento no schema; aqui o
  // fallback cobre o cliente antigo, que ainda não envia o campo.
  const profileType = payload.profile_type ?? deriveProfileType(payload.birth_date);
  const conditionIds = payload.condition_ids ?? [];
  await assertConditionsExist(supabase, conditionIds);
  const activeModules = await resolveModules(supabase, payload.active_modules, conditionIds);

  // Adulto informa o próprio contato; menor informa o do responsável. Sem escopo explícito,
  // o perfil decide — evita gravar contato no campo errado e mandar convite para o vazio.
  const contactScope = payload.contact_scope
    ?? (profileType === 'ADULT' ? 'patient' : 'responsible');
  const wantsPatientContact = contactScope === 'patient' || contactScope === 'both';
  const wantsResponsibleContact = contactScope === 'responsible' || contactScope === 'both';

  const emailPaciente = wantsPatientContact ? payload.email_paciente ?? null : null;
  const emailResponsavel = wantsResponsibleContact ? payload.email_responsavel ?? null : null;

  const inviteConfig = payload.portal_invite;
  const routing = resolveInviteRouting({
    profileType,
    contactScope,
    emailPaciente,
    emailResponsavel,
    nomePaciente: payload.name,
    nomeResponsavel: nome_responsavel ?? payload.responsaveis ?? null,
    relationship: inviteConfig?.relationship ?? null,
  });

  const inviteEmail = inviteConfig?.email ?? routing.email;
  const shouldInvite = inviteConfig?.send !== false && Boolean(inviteEmail);

  const { data: txResult, error: txError } = await supabase.rpc('create_patient_tx', {
    p_payload: {
      clinic_id: clinicId,
      professional_id: professional.id,
      created_by: caller.id,
      name: payload.name,
      birth_date: payload.birth_date,
      gender: payload.gender ?? 'not_informed',
      cpf_paciente,
      cpf_responsavel,
      nome_responsavel,
      diagnoses: payload.diagnoses ?? [],
      clinical_observations: payload.clinical_observations ?? null,
      profile_type: profileType,
      active_modules: activeModules,
      autonomy_level: defaultAutonomyForProfile(profileType),
      support_network: payload.support_network ?? null,
      occupation_routine: payload.occupation_routine ?? null,
      mapped_triggers: payload.mapped_triggers ?? null,
      ...anamnesis,
      contact_scope: contactScope,
      email_paciente: emailPaciente,
      telefone_paciente: wantsPatientContact ? payload.telefone_paciente ?? null : null,
      email_responsavel: emailResponsavel,
      telefone_responsavel: wantsResponsibleContact ? payload.telefone_responsavel ?? null : null,
      condition_ids: conditionIds,
      invite: shouldInvite
        ? {
            access_level: routing.accessLevel,
            relationship: routing.relationship,
            email: inviteEmail,
            name: inviteConfig?.name ?? routing.name,
            expires_in_hours: inviteConfig?.expires_in_hours ?? 168,
          }
        : null,
    },
  });

  if (txError || !txResult?.patient_id) {
    throw new AppError({
      code: 'PATIENT_CREATE_FAILED',
      message: txError?.message ?? 'Falha ao criar paciente',
      statusCode: 500,
    });
  }

  const patientId = txResult.patient_id as string;

  // O motor financeiro vive em TypeScript e não cabe na transação SQL. Se ele falhar, o
  // cadastro inteiro é desfeito de verdade: paciente, condições e convite somem, em vez
  // de virarem um registro soft-deleted órfão.
  let contractResult: Awaited<ReturnType<typeof upsertFinancialContract>>;
  try {
    const input = contractFromCreatePayload(payload as Record<string, unknown>);
    input.patient_id = patientId;
    contractResult = await upsertFinancialContract({
      clinicId,
      professionalId: professional.id,
      createdBy: caller.id,
      input,
    });
  } catch (err) {
    await supabase.rpc('rollback_patient_creation', { p_patient_id: patientId });
    throw err;
  }

  // O convite é entrega de valor, não pré-requisito do cadastro: uma falha de SES não
  // pode derrubar o cadastro que já está salvo. O código fica disponível na tela.
  let inviteSent = false;
  const inviteCode = (txResult.invite_code as string | null) ?? null;
  if (inviteCode && inviteEmail) {
    inviteSent = await sendPortalInviteEmail({
      inviteId: txResult.invite_id as string,
      code: inviteCode,
      to: inviteEmail,
      recipientName: inviteConfig?.name ?? routing.name,
      patientName: payload.name,
      professionalName: (professional.name as string) ?? 'seu terapeuta',
      accessLevel: routing.accessLevel,
    });
  }

  await supabase.from('audit_logs').insert({
    user_id: caller.id,
    clinic_id: clinicId,
    action: 'patient.create',
    resource_type: 'patient',
    resource_id: patientId,
    metadata: {
      profile_type: profileType,
      active_modules: activeModules,
      conditions_count: txResult.conditions_count ?? 0,
      diagnoses: payload.diagnoses ?? [],
      anamnesis_complete: Boolean((payload as Record<string, unknown>).queixa_principal),
      possui_cpf_proprio: payload.possui_cpf_proprio,
      billing_type: contractResult.contract.billing_type ?? null,
      needs_windows: contractResult.needs_windows,
      invite_access_level: inviteCode ? routing.accessLevel : null,
      invite_sent: inviteSent,
    },
  });

  return {
    patient_id: patientId,
    message: 'Paciente cadastrado com sucesso',
    contract: contractResult.contract,
    needs_windows: contractResult.needs_windows,
    next_step: contractResult.next_step,
    profile_type: profileType,
    active_modules: activeModules,
    portal_invite: inviteCode
      ? {
          code: inviteCode,
          access_level: routing.accessLevel,
          recipient: routing.recipient,
          email: inviteEmail,
          sent: inviteSent,
        }
      : null,
  };
}
