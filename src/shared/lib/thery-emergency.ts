/**
 * Espelho do protocolo de emergência para a UI.
 *
 * A fonte da verdade é o backend (`emergency-protocol.ts`). O PWA só precisa do
 * texto para renderizar o card se o stream cair no meio — nunca para decidir
 * se o protocolo vale. A decisão é sempre do servidor.
 */
export const THERY_PERSONA_LABEL = 'Acompanhante de Apoio · não substitui seu psicólogo';

export const THERY_EMERGENCY_PROTOCOL = [
  'Obrigado por me contar isso. Você não está sozinho(a) agora.',
  '',
  'O que você descreveu é sério, e eu não sou a pessoa certa para te acompanhar sozinha neste momento. Por favor, peça ajuda humana agora:',
  '',
  '• CVV — Ligue 188 (24 horas, gratuito e sigiloso)',
  '• SAMU — 192',
  '• Procure o pronto-socorro mais próximo, ou um CAPS da sua cidade',
  '',
  'Se puder, fique na companhia de alguém de confiança até conseguir esse contato.',
  '',
  'Estou avisando o(a) seu(sua) terapeuta para que ele(a) possa te dar um suporte mais próximo. Isso não substitui ligar agora.',
].join('\n');
