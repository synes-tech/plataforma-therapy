/**
 * Evita falso SEVERE em turnos curtos depois de um exercício, ou quando a
 * pessoa nega ideação ("não quero me matar, só estou nervosa").
 */

export function isCopingFollowUp(normalized: string): boolean {
  const text = normalized.trim();
  if (!text || text.length > 80) return false;
  return /^(ja )?fiz( isso| o exercicio| a respiracao)?$/.test(text)
    || /^(pronto|feito|terminei|consegui( sim)?|ok|blz|beleza|sim)$/.test(text)
    || /^ja (fiz|terminei|consegui)/.test(text);
}

export function hasExplicitSafetyDenial(normalized: string): boolean {
  const text = normalized.trim();
  if (!text) return false;
  return /nao (quero|vou|to querendo|estou querendo) (me matar|morrer|suicidar)/.test(text)
    || /nao no nivel de (querer )?(me matar|morrer|suicidio)/.test(text)
    || /nao (e|eh|estou) (querendo me matar|com ideacao|suicid)/.test(text)
    || (/isso nao precisa/.test(text) && /nao.{0,40}me matar/.test(text));
}

/** Classificador sozinho não pode virar emergência nestes turnos. */
export function classifierSevereNeedsLexicon(normalized: string): boolean {
  return isCopingFollowUp(normalized) || hasExplicitSafetyDenial(normalized);
}
