export function sessionWorkspacePath(patientId?: string, scheduleId?: string | null): string {
  if (!patientId) return '/session';
  if (!scheduleId) return `/session/${patientId}`;
  return `/session/${patientId}?scheduleId=${encodeURIComponent(scheduleId)}`;
}
