/**
 * Camada 0 — detecção determinística de risco, ~1ms, sem LLM.
 *
 * Existe porque o classificador pode falhar, atrasar ou ser enganado. Esta camada
 * nunca substitui o classificador: um hit explícito já dispara o protocolo de
 * emergência; um hit fraco só marca o turno como suspeito e obriga a Camada 1.
 *
 * O léxico é em português do Brasil, com gíria e grafia sem acento. Expressões
 * idiomáticas ("morrer de vergonha") são excluídas de propósito — um falso
 * positivo em massa ensinaria o terapeuta a ignorar o alerta.
 */

export type LexiconLevel = 'LOW' | 'SUSPECT' | 'SEVERE';

export interface LexiconHit {
  id: string;
  level: Exclude<LexiconLevel, 'LOW'>;
}

export interface LexiconScan {
  level: LexiconLevel;
  signals: LexiconHit[];
  normalized: string;
}

export function normalizeRiskText(raw: string): string {
  return raw
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '')
    .toLowerCase()
    .replace(/[“”"']/g, '')
    .replace(/\s+/g, ' ')
    .trim();
}

/** Expressões que usam "morrer/matar" sem ideação. Avaliadas no texto normalizado. */
const IDIOM_CANCEL: RegExp[] = [
  /morrer de (vergonha|rir|tedio|sono|fome|vontade|ciume|medo|saudade)/,
  /me matando de (trabalh|estud|rir|correr|fazer)/,
  /matar (aula|saudade|o tempo|a fome|o tesao)/,
  /morrer de amor/,
];

/**
 * Hits explícitos — precisão acima de recall. Cada um sozinho já é SEVERE.
 * Planos, métodos e pedido de ajuda para morrer entram aqui.
 */
const SEVERE_PATTERNS: Array<{ id: string; re: RegExp }> = [
  { id: 'suicidio_explicito', re: /\b(suicidio|suicidar|me suicidar|vou me suicidar)\b/ },
  { id: 'vou_me_matar', re: /\b(vou|quero|decidi|vou acabar|vou terminar) (me matar|com a minha vida)\b/ },
  { id: 'nao_quero_viver', re: /\b(nao quero|nao aguento|cansei de) (mais )?(viver|continuar vivo|continuar viva)\b/ },
  { id: 'plano_suicidio', re: /\b(ja sei como|tenho um plano|planejei|hoje eu vou) .{0,40}(me matar|morrer|acabar comigo)\b/ },
  { id: 'metodo_queda', re: /\b(vou|quero|pensei em) (pular|me jogar) (do|da|de)\b/ },
  { id: 'metodo_enforcar', re: /\b(enforcar|me enforcar|forca)\b/ },
  { id: 'metodo_intoxicar', re: /\b(tomar todos os (remedios|comprimidos)|misturar com alcool e (remedio|comprimido))\b/ },
  { id: 'metodo_arma', re: /\b(dar um tiro|me matar com|arma de fogo)\b/ },
  { id: 'cortar_pulsos', re: /\b(cortar os pulsos|cortar os bracos|me cortar os pulsos)\b/ },
  { id: 'carta_despedida', re: /\b(carta de despedida|deixei um recado de despedida|ultima mensagem)\b/ },
  { id: 'automutilacao', re: /\b(automutila|me mutilei|estou me cortando|me cortei de proposito)\b/ },
  { id: 'homicidio', re: /\b(vou matar (ele|ela|eles|todo|minha|meu)|matar todo mundo|exterminar)\b/ },
  { id: 'abuso_sexual_imediato', re: /\b(me (estuprou|estupra)|abuso sexual|estou sendo abusad[oa])\b/ },
];

/**
 * Hits fracos — eufemismo e sofrimento intenso. Sozinhos não disparam o protocolo;
 * obrigam o classificador a olhar o turno com mais cuidado.
 */
const SUSPECT_PATTERNS: Array<{ id: string; re: RegExp }> = [
  { id: 'quero_sumir', re: /\b(quero sumir|queria sumir|sumir de vez)\b/ },
  { id: 'nao_acordar', re: /\b(dormir e nao acordar|nao queria acordar|queria nao acordar)\b/ },
  { id: 'melhor_sem_mim', re: /\b(melhor sem mim|o mundo sem mim|ninguem ia sentir falta)\b/ },
  { id: 'nao_aguento', re: /\b(nao aguento mais|nao to aguentando|to no limite)\b/ },
  { id: 'fundo_poco', re: /\b(fundo do poco|nao vejo saida|nao tem saida)\b/ },
  { id: 'vontade_morrer', re: /\b(vontade de morrer|queria estar mort[oa]|melhor mort[oa])\b/ },
  { id: 'crise_panico', re: /\b(crise de panico|ataque de panico|nao consigo respirar)\b/ },
  { id: 'me_machucar', re: /\b(vontade de me machucar|quase me cortei|pensei em me cortar)\b/ },
  { id: 'acabar_com_tudo', re: /\b(vou acabar com tudo|acabar com tudo|acabar comigo)\b/ },
];

const DISTRESS_SIGNAL_IDS = new Set(['nao_aguento', 'fundo_poco', 'crise_panico']);
const EXIT_SIGNAL_IDS = new Set([
  'quero_sumir',
  'nao_acordar',
  'melhor_sem_mim',
  'vontade_morrer',
  'me_machucar',
  'acabar_com_tudo',
]);

function matchesAny(text: string, patterns: RegExp[]): boolean {
  return patterns.some((re) => re.test(text));
}

export function scanRiskLexicon(raw: string): LexiconScan {
  const normalized = normalizeRiskText(raw);
  if (!normalized) return { level: 'LOW', signals: [], normalized };

  const idiomOnly = matchesAny(normalized, IDIOM_CANCEL);

  const signals: LexiconHit[] = [];
  for (const { id, re } of SEVERE_PATTERNS) {
    if (re.test(normalized)) signals.push({ id, level: 'SEVERE' });
  }

  // Idioma cancelado só anula SEVERE se o único match for genérico demais.
  // "vou me matar" nunca é idioma.
  const severeHits = signals.filter((s) => s.level === 'SEVERE');
  if (severeHits.length > 0) {
    return { level: 'SEVERE', signals, normalized };
  }

  if (idiomOnly) {
    return { level: 'LOW', signals: [], normalized };
  }

  for (const { id, re } of SUSPECT_PATTERNS) {
    if (re.test(normalized)) signals.push({ id, level: 'SUSPECT' });
  }

  const hasDistress = signals.some((hit) => DISTRESS_SIGNAL_IDS.has(hit.id));
  const hasExit = signals.some((hit) => EXIT_SIGNAL_IDS.has(hit.id));
  if (hasDistress && hasExit) {
    return { level: 'SEVERE', signals, normalized };
  }

  if (signals.length > 0) {
    return { level: 'SUSPECT', signals, normalized };
  }

  return { level: 'LOW', signals: [], normalized };
}
