/**
 * @vitest-environment node
 *
 * Cobre as regras do Onboarding Universal que vivem no backend Deno: derivação de perfil,
 * módulos clínicos, roteamento do convite e o conteúdo dos dois e-mails de convite.
 */
import { describe, expect, it } from 'vitest';

import {
  calculateAge,
  defaultAutonomyForProfile,
  deriveProfileType,
  normalizeModules,
  resolveInviteRouting,
  validateProfileRequirements,
} from '../../../supabase/functions/_shared/patient-profile.ts';
import {
  buildCaregiverInviteEmail,
  buildPortalInviteEmail,
  buildSelfInviteEmail,
  formatExpiryLabel,
} from '../../../supabase/functions/_shared/invite-email-templates.ts';

const HOJE = new Date('2026-08-22T12:00:00Z');

describe('derivação de perfil no backend', () => {
  it('classifica pelas mesmas fronteiras do banco', () => {
    expect(deriveProfileType('2020-01-10', HOJE)).toBe('CHILD');
    expect(deriveProfileType('2013-08-22', HOJE)).toBe('ADOLESCENT');
    expect(deriveProfileType('2008-08-22', HOJE)).toBe('ADULT');
  });

  it('não vira adolescente um dia antes do 13º aniversário', () => {
    expect(deriveProfileType('2013-08-23', HOJE)).toBe('CHILD');
  });

  it('não vira adulto um dia antes do 18º aniversário', () => {
    expect(deriveProfileType('2008-08-23', HOJE)).toBe('ADOLESCENT');
  });

  it('trata data ausente ou inválida como adulto', () => {
    expect(deriveProfileType(null, HOJE)).toBe('ADULT');
    expect(deriveProfileType('sem-data', HOJE)).toBe('ADULT');
  });

  it('calcula idade sem depender do fuso local', () => {
    expect(calculateAge('2000-08-22', HOJE)).toBe(26);
    expect(calculateAge('2000-08-23', HOJE)).toBe(25);
  });

  it('associa autonomia coerente com a faixa', () => {
    expect(defaultAutonomyForProfile('CHILD')).toBe('DEPENDENT');
    expect(defaultAutonomyForProfile('ADOLESCENT')).toBe('SUPPORTED');
    expect(defaultAutonomyForProfile('ADULT')).toBe('SELF_MANAGED');
  });
});

describe('módulos clínicos', () => {
  it('garante o módulo base mesmo quando nada é enviado', () => {
    expect(normalizeModules(undefined)).toEqual(['CLINICO_GERAL']);
    expect(normalizeModules([])).toEqual(['CLINICO_GERAL']);
  });

  it('acrescenta o base sem descartar o especializado', () => {
    expect(normalizeModules(['NEURODESENVOLVIMENTO'])).toEqual([
      'CLINICO_GERAL',
      'NEURODESENVOLVIMENTO',
    ]);
  });

  it('remove duplicatas e ignora valores desconhecidos', () => {
    expect(normalizeModules(['NEURODESENVOLVIMENTO', 'NEURODESENVOLVIMENTO', 'INEXISTENTE']))
      .toEqual(['CLINICO_GERAL', 'NEURODESENVOLVIMENTO']);
  });
});

describe('roteamento do convite', () => {
  it('adulto recebe SELF e o convite vai para o próprio paciente', () => {
    const routing = resolveInviteRouting({
      profileType: 'ADULT',
      emailPaciente: 'ana@exemplo.com',
      emailResponsavel: 'mae@exemplo.com',
      nomePaciente: 'Ana',
      nomeResponsavel: 'Mãe da Ana',
    });

    expect(routing.accessLevel).toBe('SELF');
    expect(routing.email).toBe('ana@exemplo.com');
    expect(routing.recipient).toBe('patient');
    expect(routing.name).toBe('Ana');
  });

  it('criança recebe CAREGIVER e o convite vai para o responsável', () => {
    const routing = resolveInviteRouting({
      profileType: 'CHILD',
      emailPaciente: 'crianca@exemplo.com',
      emailResponsavel: 'mae@exemplo.com',
      nomePaciente: 'Pedro',
      nomeResponsavel: 'Maria',
    });

    expect(routing.accessLevel).toBe('CAREGIVER');
    expect(routing.email).toBe('mae@exemplo.com');
    expect(routing.recipient).toBe('caregiver');
    expect(routing.name).toBe('Maria');
  });

  it('adolescente não recebe acesso autônomo pelo cadastro', () => {
    const routing = resolveInviteRouting({
      profileType: 'ADOLESCENT',
      emailPaciente: 'jovem@exemplo.com',
      emailResponsavel: 'pai@exemplo.com',
      nomePaciente: 'Lia',
      nomeResponsavel: 'Pai da Lia',
    });

    expect(routing.accessLevel).toBe('CAREGIVER');
    expect(routing.email).toBe('pai@exemplo.com');
  });

  it('adulto com apoiador manda o convite ao cuidador, não SELF para o e-mail alheio', () => {
    const routing = resolveInviteRouting({
      profileType: 'ADULT',
      contactScope: 'responsible',
      emailPaciente: 'ana@exemplo.com',
      emailResponsavel: 'irma@exemplo.com',
      nomePaciente: 'Ana',
      nomeResponsavel: 'Irmã da Ana',
    });

    expect(routing.accessLevel).toBe('CAREGIVER');
    expect(routing.email).toBe('irma@exemplo.com');
    expect(routing.recipient).toBe('caregiver');
  });

  it('adulto com contato de ambos mantém o acesso próprio', () => {
    const routing = resolveInviteRouting({
      profileType: 'ADULT',
      contactScope: 'both',
      emailPaciente: 'ana@exemplo.com',
      emailResponsavel: 'irma@exemplo.com',
      nomePaciente: 'Ana',
    });

    expect(routing.accessLevel).toBe('SELF');
    expect(routing.email).toBe('ana@exemplo.com');
  });

  it('menor de idade continua CAREGIVER mesmo com escopo do paciente', () => {
    const routing = resolveInviteRouting({
      profileType: 'ADOLESCENT',
      contactScope: 'patient',
      emailPaciente: 'jovem@exemplo.com',
      emailResponsavel: 'pai@exemplo.com',
      nomePaciente: 'Lia',
      nomeResponsavel: 'Pai da Lia',
    });

    expect(routing.accessLevel).toBe('CAREGIVER');
    expect(routing.email).toBe('pai@exemplo.com');
  });

  it('devolve email nulo quando o contato do destinatário não foi informado', () => {
    const routing = resolveInviteRouting({
      profileType: 'ADULT',
      emailPaciente: null,
      emailResponsavel: 'outro@exemplo.com',
      nomePaciente: 'Sem contato',
    });

    expect(routing.email).toBeNull();
  });
});

describe('validação condicional por perfil', () => {
  const paths = (issues: { path: string }[]) => issues.map((i) => i.path).sort();

  it('exige ao menos uma condição, por texto livre ou por taxonomia', () => {
    expect(paths(validateProfileRequirements({ birth_date: '1990-01-01' }, HOJE)))
      .toEqual(['condition_ids']);
    expect(validateProfileRequirements({ diagnoses: ['TDAH'] }, HOJE)).toEqual([]);
    expect(validateProfileRequirements({ condition_ids: ['uuid'] }, HOJE)).toEqual([]);
  });

  it('adulto declarado precisa do próprio e-mail', () => {
    const issues = validateProfileRequirements({
      birth_date: '1990-01-01',
      profile_type: 'ADULT',
      diagnoses: ['Ansiedade'],
    }, HOJE);
    expect(paths(issues)).toEqual(['email_paciente']);
  });

  it('adulto completo passa sem exigir dinâmica familiar', () => {
    const issues = validateProfileRequirements({
      birth_date: '1990-01-01',
      profile_type: 'ADULT',
      diagnoses: ['Ansiedade'],
      email_paciente: 'ana@exemplo.com',
    }, HOJE);
    expect(issues).toEqual([]);
  });

  it('menor declarado exige responsável, composição familiar e e-mail do responsável', () => {
    const issues = validateProfileRequirements({
      birth_date: '2018-01-01',
      profile_type: 'CHILD',
      diagnoses: ['TEA'],
    }, HOJE);
    expect(paths(issues)).toEqual(['composicao_familiar', 'email_responsavel', 'responsaveis']);
  });

  it('rejeita perfil que não confere com a data de nascimento', () => {
    const issues = validateProfileRequirements({
      birth_date: '2018-01-01',
      profile_type: 'ADULT',
      diagnoses: ['TEA'],
    }, HOJE);
    expect(paths(issues)).toEqual(['profile_type']);
    expect(issues[0]?.message).toContain('CHILD');
  });

  it('não impõe as regras novas ao cliente que ainda não declara o perfil', () => {
    // Exatamente o payload que o wizard em produção envia hoje para uma criança.
    const issues = validateProfileRequirements({
      birth_date: '2018-01-01',
      diagnoses: ['TEA'],
      email_paciente: 'contato@exemplo.com',
    }, HOJE);
    expect(issues).toEqual([]);
  });
});

describe('e-mails de convite', () => {
  const base = {
    recipientName: 'Maria',
    patientName: 'Pedro',
    professionalName: 'Dra. Lívia',
    code: 'AB12CD34',
    portalUrl: 'https://www.unithery.com/invite',
  };

  it('convite de cuidador fala sobre acompanhar o paciente', () => {
    const mail = buildCaregiverInviteEmail(base);
    expect(mail.subject).toContain('Pedro');
    expect(mail.subject).toContain('Dra. Lívia');
    expect(mail.html).toContain('AB12CD34');
    expect(mail.text).toContain('AB12CD34');
    expect(mail.html).toContain('acompanhar');
  });

  it('convite do próprio paciente nunca usa a palavra família', () => {
    const mail = buildSelfInviteEmail({ ...base, recipientName: 'Ana', patientName: 'Ana' });
    expect(mail.html.toLowerCase()).not.toContain('família');
    expect(mail.text.toLowerCase()).not.toContain('família');
    expect(mail.html.toLowerCase()).not.toContain('responsável');
    expect(mail.subject).toBe('Dra. Lívia criou seu espaço na Unithery');
  });

  it('os dois convites são textos diferentes, não o mesmo com troca de nome', () => {
    const caregiver = buildCaregiverInviteEmail(base);
    const self = buildSelfInviteEmail(base);
    expect(caregiver.subject).not.toBe(self.subject);
    expect(caregiver.html).not.toBe(self.html);
  });

  it('escapa HTML vindo de nome do paciente', () => {
    const mail = buildCaregiverInviteEmail({ ...base, patientName: '<script>alert(1)</script>' });
    expect(mail.html).not.toContain('<script>');
    expect(mail.html).toContain('&lt;script&gt;');
  });

  it('seleciona o template pelo nível de acesso', () => {
    expect(buildPortalInviteEmail('SELF', base).subject)
      .toBe(buildSelfInviteEmail(base).subject);
    expect(buildPortalInviteEmail('CAREGIVER', base).subject)
      .toBe(buildCaregiverInviteEmail(base).subject);
  });

  it('formata validade em linguagem humana', () => {
    expect(formatExpiryLabel(168)).toBe('7 dias');
    expect(formatExpiryLabel(24)).toBe('1 dia');
    expect(formatExpiryLabel(1)).toBe('1 hora');
    expect(formatExpiryLabel(5)).toBe('5 horas');
  });
});
