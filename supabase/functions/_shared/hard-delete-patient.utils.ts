export function postgrestErrorMessage(error: unknown): string {
  if (!error) return 'erro desconhecido';
  if (typeof error === 'string') return error;
  if (error instanceof Error && error.message) return error.message;
  const obj = error as { message?: string; details?: string; hint?: string; code?: string };
  return [obj.code, obj.message, obj.details, obj.hint].filter(Boolean).join(' — ') || 'Falha ao excluir paciente';
}
