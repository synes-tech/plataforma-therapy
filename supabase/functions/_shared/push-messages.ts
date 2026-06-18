/**
 * Mensagens empáticas diversificadas para lembretes de diário.
 * Variante determinística (sem LLM) para confiabilidade no cron.
 */

const TITLE_TEMPLATES = [
  'Diário de {name}',
  'Como foi o dia?',
  'Unithery — Diário',
  'Um minutinho por {name}',
];

const BODY_TEMPLATES = [
  'Como foi o dia do {name} hoje? Conta pra gente no diário de rotina!',
  'Sentimos sua falta no diário de {name}. Um relato rápido ajuda muito o terapeuta.',
  'Que tal registrar como foi a rotina do {name}? Leva só um minutinho.',
  'O terapeuta adora acompanhar o dia a dia do {name}. Que tal atualizar o diário?',
  'Tudo bem por aí? Um registro no diário de {name} mantém o cuidado em dia.',
  'Como {name} dormiu e se sentiu hoje? Seu relato faz diferença no tratamento.',
];

function firstName(fullName: string): string {
  const trimmed = fullName.trim();
  if (!trimmed) return 'seu filho(a)';
  return trimmed.split(/\s+/)[0] ?? trimmed;
}

/** Hash simples para escolher variante estável por usuário + dia */
export function reminderVariantSeed(userId: string, patientId: string, dayKey: string): number {
  let hash = 0;
  const str = `${userId}:${patientId}:${dayKey}`;
  for (let i = 0; i < str.length; i++) {
    hash = (hash * 31 + str.charCodeAt(i)) >>> 0;
  }
  return hash;
}

export function buildDiaryReminderMessage(
  patientName: string,
  variantSeed: number,
): { title: string; body: string } {
  const name = firstName(patientName);
  const titleIdx = variantSeed % TITLE_TEMPLATES.length;
  const bodyIdx = Math.floor(variantSeed / TITLE_TEMPLATES.length) % BODY_TEMPLATES.length;

  const title = TITLE_TEMPLATES[titleIdx]!.replace('{name}', name);
  const body = BODY_TEMPLATES[bodyIdx]!.replace(/{name}/g, name);

  return { title, body };
}

export function dayKeyUtc(): string {
  return new Date().toISOString().slice(0, 10);
}
