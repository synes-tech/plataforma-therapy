/**
 * Protocolo de emergência do Acompanhante.
 *
 * Este texto é constante versionada, revisada por humano. Um LLM alucinar um
 * telefone de emergência — ou inventar um CAPS que não existe — é inaceitável.
 * Quando o risco é SEVERE, o backend substitui a resposta gerada por isto.
 */

export const EMERGENCY_PROTOCOL_VERSION = '2026-08-22';

export const EMERGENCY_PROTOCOL_TEXT = [
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

/** Resposta curta se o modelo falhar num turno de sofrimento intenso, sem ser SEVERE. */
export const COPING_FALLBACK_TEXT = [
  'Sinto que isso está pesado agora. Vamos desacelerar juntos.',
  '',
  'Se puder, faça comigo: inspire pelo nariz contando até 4, segure até 4, solte pela boca até 4. Repita três vezes.',
  '',
  'Olhe ao redor e nomeie 5 coisas que você vê. Depois 4 que você consegue tocar. Isso ajuda o corpo a voltar para o presente.',
  '',
  'Se a crise crescer ou você sentir que pode se machucar, ligue 188 (CVV) ou 192 (SAMU). E leve isso para a próxima sessão com seu psicólogo — ele é quem pode te acompanhar de verdade.',
].join('\n');
