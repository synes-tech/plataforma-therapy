export function normalizeNameForConfirm(value: string): string {
  return value.trim().replace(/\s+/g, ' ').toLowerCase();
}

export function namesMatchForDelete(input: string, patientName: string): boolean {
  if (!input.trim() || !patientName.trim()) return false;
  return normalizeNameForConfirm(input) === normalizeNameForConfirm(patientName);
}
