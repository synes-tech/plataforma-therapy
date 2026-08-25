/**
 * @vitest-environment node
 */
import { describe, expect, it } from 'vitest';
import { shouldEmailCrisisAlert } from '../../../supabase/functions/_shared/companion/alerts.ts';
import {
  buildCrisisAlertEmail,
  clipReportedText,
} from '../../../supabase/functions/_shared/companion/crisis-email-templates.ts';

describe('e-mail de crise para o psicólogo', () => {
  it('SEVERE da Ivy sempre dispara, mesmo com a preferência desligada', () => {
    expect(shouldEmailCrisisAlert({ kind: 'companion_severe', clinicAllowsEmail: false })).toBe(true);
  });

  it('check-in de crise respeita a preferência da clínica', () => {
    expect(shouldEmailCrisisAlert({ kind: 'checkin_crisis', clinicAllowsEmail: true })).toBe(true);
    expect(shouldEmailCrisisAlert({ kind: 'checkin_crisis', clinicAllowsEmail: false })).toBe(false);
  });

  it('inclui o relato no e-mail urgente da Ivy', () => {
    const email = buildCrisisAlertEmail({
      professionalName: 'João',
      patientName: 'Ana Silva',
      kind: 'companion_severe',
      reportedText: 'Não aguento mais, quero sumir do mapa, vou acabar com tudo.',
      recordUrl: 'https://unithery.com/patients/p1/copilot',
    });
    expect(email.subject).toContain('Ana Silva');
    expect(email.subject).toMatch(/Urgente/i);
    expect(email.text).toContain('quero sumir do mapa');
    expect(email.html).toContain('quero sumir do mapa');
    expect(email.html).toContain('/patients/p1/copilot');
  });

  it('inclui o nível da crise no check-in', () => {
    const email = buildCrisisAlertEmail({
      professionalName: 'João',
      patientName: 'Lucas',
      kind: 'checkin_crisis',
      reportedText: 'Teve crise de ansiedade no ônibus.',
      recordUrl: 'https://unithery.com/patients/p2/checkins?date=2026-08-24',
      crisisLevel: 4,
    });
    expect(email.subject).toMatch(/Crise/);
    expect(email.html).toContain('Nível 4/5');
    expect(email.text).toContain('Teve crise de ansiedade no ônibus.');
  });

  it('corta relatos longos', () => {
    expect(clipReportedText('a'.repeat(900)).endsWith('…')).toBe(true);
    expect(clipReportedText('  oi  mundo  ')).toBe('oi mundo');
  });
});
