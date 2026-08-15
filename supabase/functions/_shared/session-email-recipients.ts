export type ContactScope = 'patient' | 'responsible' | 'both';

export type SessionEmailRecipientRole = 'patient' | 'responsible' | 'family' | 'professional';

export interface SessionEmailRecipient {
  email: string;
  name: string;
  role: SessionEmailRecipientRole;
}

export interface PatientContactRow {
  id: string;
  name: string;
  contact_scope?: string | null;
  email_paciente?: string | null;
  telefone_paciente?: string | null;
  email_responsavel?: string | null;
  telefone_responsavel?: string | null;
  nome_responsavel?: string | null;
}

export interface FamilyContactRow {
  name?: string | null;
  email?: string | null;
  phone?: string | null;
}

function normalizeEmail(value: string | null | undefined): string | null {
  const email = value?.trim().toLowerCase() ?? '';
  if (!email || !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)) return null;
  return email;
}

/**
 * Resolve destinatários de e-mail de sessão a partir do contato do paciente.
 * Fallback: primeiro family_member com e-mail (comportamento legado).
 */
export function resolveSessionEmailRecipients(
  patient: PatientContactRow,
  familyFallback?: FamilyContactRow | null,
): SessionEmailRecipient[] {
  const scope = (patient.contact_scope ?? null) as ContactScope | null;
  const recipients: SessionEmailRecipient[] = [];
  const seen = new Set<string>();

  function push(email: string | null, name: string, role: SessionEmailRecipientRole) {
    if (!email || seen.has(email)) return;
    seen.add(email);
    recipients.push({ email, name: name.trim() || 'Contato', role });
  }

  if (scope === 'patient' || scope === 'both') {
    push(normalizeEmail(patient.email_paciente), patient.name, 'patient');
  }
  if (scope === 'responsible' || scope === 'both') {
    push(
      normalizeEmail(patient.email_responsavel),
      patient.nome_responsavel?.trim() || 'Responsável',
      'responsible',
    );
  }

  if (recipients.length === 0) {
    // Paciente legado sem contact_scope: tenta e-mails diretos se existirem
    if (!scope) {
      push(normalizeEmail(patient.email_paciente), patient.name, 'patient');
      push(
        normalizeEmail(patient.email_responsavel),
        patient.nome_responsavel?.trim() || 'Responsável',
        'responsible',
      );
    }
  }

  if (recipients.length === 0 && familyFallback) {
    push(
      normalizeEmail(familyFallback.email),
      familyFallback.name?.trim() || 'Responsável',
      'family',
    );
  }

  return recipients;
}

/** Contato de exibição na agenda (prioriza paciente → responsável → família). */
export function pickDisplayContact(
  patient: PatientContactRow,
  familyFallback?: FamilyContactRow | null,
): { name: string; phone: string | null; email: string | null } | null {
  const recipients = resolveSessionEmailRecipients(patient, familyFallback);
  if (recipients.length === 0 && !patient.telefone_paciente && !patient.telefone_responsavel && !familyFallback?.phone) {
    return null;
  }

  const primary = recipients[0];
  const scope = patient.contact_scope;
  let phone: string | null = null;
  if (scope === 'patient' || (!scope && patient.telefone_paciente)) {
    phone = patient.telefone_paciente?.trim() || null;
  }
  if (!phone && (scope === 'responsible' || scope === 'both' || !scope)) {
    phone = patient.telefone_responsavel?.trim() || null;
  }
  if (!phone) phone = familyFallback?.phone?.trim() || null;
  if (!phone && scope === 'both') {
    phone = patient.telefone_paciente?.trim() || null;
  }

  return {
    name: primary?.name ?? patient.name,
    email: primary?.email ?? null,
    phone,
  };
}
