export function ensureAuthUserRpcArgs(id: string, email?: string | null) {
  const trimmed = email?.trim().toLowerCase() ?? '';
  return {
    p_id: id,
    p_email: trimmed.length > 0 ? trimmed : null,
  };
}

/** created_by do vínculo = profissional do convite; fallback no UID novo. */
export function resolveInviteCreatedBy(
  inviteCreatedBy: string | null | undefined,
  newUserId: string,
): string {
  return inviteCreatedBy || newUserId;
}
