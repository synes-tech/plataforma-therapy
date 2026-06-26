export const INVITE_CODE_LENGTH = 8;

export function normalizeInviteCodeInput(raw: string): string {
  return raw.replace(/\s/g, '').slice(0, INVITE_CODE_LENGTH);
}

export function isInviteCodeComplete(code: string): boolean {
  return normalizeInviteCodeInput(code).length === INVITE_CODE_LENGTH;
}
