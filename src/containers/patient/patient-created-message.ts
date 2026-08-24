import type { PatientCreatedSummary } from './PatientCreateModal';

/**
 * O que o terapeuta lê depois de cadastrar.
 *
 * O convite é a parte do fluxo que acontece fora da tela — se ele falhar em silêncio, o
 * terapeuta descobre dias depois, quando a família reclama que nunca recebeu nada. Por isso
 * a mensagem diz para quem o convite foi, e diz explicitamente quando não foi.
 */
export function patientCreatedMessage(
  summary: PatientCreatedSummary,
): { message: string; variant: 'success' | 'error' } {
  const name = summary.patientName.trim() || 'Paciente';
  const invite = summary.portalInvite;

  if (!invite) {
    return { message: `${name} foi cadastrado.`, variant: 'success' };
  }

  if (!invite.sent) {
    return {
      message: `${name} foi cadastrado, mas o convite do portal não pôde ser enviado. Use o código ${invite.code} na ficha do paciente.`,
      variant: 'error',
    };
  }

  const destino = invite.recipient === 'patient' ? 'para o paciente' : 'para o responsável';
  const email = invite.email ? ` (${invite.email})` : '';
  return {
    message: `${name} foi cadastrado e o convite do portal foi enviado ${destino}${email}.`,
    variant: 'success',
  };
}
