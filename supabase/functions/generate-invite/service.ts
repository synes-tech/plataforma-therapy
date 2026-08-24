import { createUserClient, createServiceClient } from '../_shared/supabase.ts';
import { AppError, ForbiddenError, ValidationError } from '../_shared/errors.ts';
import type { AuthenticatedUser } from '../_shared/auth.ts';
import { deriveProfileType, type PortalAccessLevel } from '../_shared/patient-profile.ts';
import { sendPortalInviteEmail } from '../_shared/invite-email.ts';
import type { GenerateInvitePayload, GenerateInviteResponse } from './types.ts';

export async function generateInvite(
  payload: GenerateInvitePayload,
  caller: AuthenticatedUser,
  token: string,
): Promise<GenerateInviteResponse> {
  const supabase = createUserClient(token);
  const serviceClient = createServiceClient();
  const clinicId = caller.clinic_id;

  if (!clinicId) {
    throw new AppError({ code: 'NO_CLINIC', message: 'User not associated with a clinic', statusCode: 400 });
  }

  // 1. Get professional record
  const { data: professional } = await supabase
    .from('professionals')
    .select('id, name')
    .eq('user_id', caller.id)
    .is('deleted_at', null)
    .single();

  if (!professional) {
    throw new AppError({ code: 'NOT_A_PROFESSIONAL', message: 'User is not a professional', statusCode: 403 });
  }

  // 2. Verify patient belongs to this professional
  const { data: patient } = await supabase
    .from('patients')
    .select('id, name, professional_id, profile_type, birth_date, email_paciente, email_responsavel')
    .eq('id', payload.patient_id)
    .is('deleted_at', null)
    .single();

  if (!patient) {
    throw new AppError({ code: 'PATIENT_NOT_FOUND', message: 'Patient not found', statusCode: 404 });
  }

  if (patient.professional_id !== professional.id) {
    throw new ForbiddenError('This patient does not belong to you');
  }

  // 2b. Nível de acesso: derivado do perfil quando não informado.
  const profileType = (patient.profile_type as ReturnType<typeof deriveProfileType> | null)
    ?? deriveProfileType(patient.birth_date as string | null);
  const accessLevel: PortalAccessLevel = payload.access_level
    ?? (profileType === 'ADULT' ? 'SELF' : 'CAREGIVER');

  // Um menor de idade não recebe acesso autônomo pelo cadastro. O caminho para isso é o
  // consentimento registrado do responsável, não um parâmetro de convite.
  if (accessLevel === 'SELF' && profileType !== 'ADULT') {
    throw new ValidationError({
      access_level: ['Acesso autônomo (SELF) exige paciente adulto ou consentimento do responsável registrado.'],
    });
  }

  if (accessLevel === 'SELF') {
    const { data: existingSelf } = await serviceClient
      .from('patient_family_links')
      .select('id')
      .eq('patient_id', patient.id)
      .eq('access_level', 'SELF')
      .is('revoked_at', null)
      .maybeSingle();

    if (existingSelf) {
      throw new AppError({
        code: 'SELF_ACCESS_ALREADY_EXISTS',
        message: 'Este paciente já possui acesso próprio ao portal.',
        statusCode: 409,
      });
    }
  }

  const inviteEmail = payload.email
    ?? (accessLevel === 'SELF'
      ? (patient.email_paciente as string | null)
      : (patient.email_responsavel as string | null));

  // 3. Generate unique code (retry up to 3 times for collision)
  let code: string | null = null;
  for (let attempt = 0; attempt < 3; attempt++) {
    const { data: codeResult } = await serviceClient.rpc('generate_invite_code');
    const candidateCode = codeResult as string;

    // Check uniqueness
    const { data: existing } = await serviceClient
      .from('invites')
      .select('id')
      .eq('code', candidateCode)
      .single();

    if (!existing) {
      code = candidateCode;
      break;
    }
  }

  if (!code) {
    throw new AppError({ code: 'CODE_GENERATION_FAILED', message: 'Failed to generate unique code', statusCode: 500 });
  }

  // 4. Calculate expiration
  const expiresAt = new Date(Date.now() + (payload.expires_in_hours ?? 72) * 60 * 60 * 1000);

  // 5. Create invite
  const { data: invite, error } = await serviceClient
    .from('invites')
    .insert({
      clinic_id: clinicId,
      patient_id: payload.patient_id,
      professional_id: professional.id,
      code,
      status: 'pending',
      relationship: payload.relationship
        ?? (accessLevel === 'SELF' ? 'o próprio paciente' : 'responsável'),
      access_level: accessLevel,
      invited_email: inviteEmail,
      invited_name: payload.name ?? (accessLevel === 'SELF' ? (patient.name as string) : null),
      expires_at: expiresAt.toISOString(),
      created_by: caller.id,
    })
    .select('id')
    .single();

  if (error || !invite) {
    throw new AppError({ code: 'INVITE_CREATE_FAILED', message: error?.message ?? 'Failed to create invite', statusCode: 500 });
  }

  // 6. Envio do e-mail. Falha de SES não invalida o convite: o código já existe e o
  // terapeuta pode compartilhá-lo manualmente.
  let emailSent = false;
  if (inviteEmail) {
    emailSent = await sendPortalInviteEmail({
      inviteId: invite.id,
      code,
      to: inviteEmail,
      recipientName: payload.name ?? (accessLevel === 'SELF' ? (patient.name as string) : 'responsável'),
      patientName: patient.name as string,
      professionalName: (professional.name as string) ?? 'seu terapeuta',
      accessLevel,
      expiresInHours: payload.expires_in_hours ?? 72,
    });
  }

  // 7. Audit log
  await serviceClient.from('audit_logs').insert({
    user_id: caller.id,
    clinic_id: clinicId,
    action: 'invite.generate',
    resource_type: 'invite',
    resource_id: invite.id,
    metadata: {
      patient_id: payload.patient_id,
      relationship: payload.relationship,
      access_level: accessLevel,
      email_sent: emailSent,
    },
  });

  return {
    invite_id: invite.id,
    code,
    expires_at: expiresAt.toISOString(),
    patient_name: patient.name,
    access_level: accessLevel,
    email_sent: emailSent,
    message: 'Invite generated successfully',
  };
}
