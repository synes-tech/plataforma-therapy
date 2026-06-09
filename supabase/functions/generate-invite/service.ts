import { createUserClient, createServiceClient } from '../_shared/supabase.ts';
import { AppError, ForbiddenError } from '../_shared/errors.ts';
import type { AuthenticatedUser } from '../_shared/auth.ts';
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
    .select('id')
    .eq('user_id', caller.id)
    .is('deleted_at', null)
    .single();

  if (!professional) {
    throw new AppError({ code: 'NOT_A_PROFESSIONAL', message: 'User is not a professional', statusCode: 403 });
  }

  // 2. Verify patient belongs to this professional
  const { data: patient } = await supabase
    .from('patients')
    .select('id, name, professional_id')
    .eq('id', payload.patient_id)
    .is('deleted_at', null)
    .single();

  if (!patient) {
    throw new AppError({ code: 'PATIENT_NOT_FOUND', message: 'Patient not found', statusCode: 404 });
  }

  if (patient.professional_id !== professional.id) {
    throw new ForbiddenError('This patient does not belong to you');
  }

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
      relationship: payload.relationship ?? 'responsável',
      expires_at: expiresAt.toISOString(),
      created_by: caller.id,
    })
    .select('id')
    .single();

  if (error || !invite) {
    throw new AppError({ code: 'INVITE_CREATE_FAILED', message: error?.message ?? 'Failed to create invite', statusCode: 500 });
  }

  // 6. Audit log
  await serviceClient.from('audit_logs').insert({
    user_id: caller.id,
    clinic_id: clinicId,
    action: 'invite.generate',
    resource_type: 'invite',
    resource_id: invite.id,
    metadata: { patient_id: payload.patient_id, relationship: payload.relationship },
  });

  return {
    invite_id: invite.id,
    code,
    expires_at: expiresAt.toISOString(),
    patient_name: patient.name,
    message: 'Invite generated successfully',
  };
}
