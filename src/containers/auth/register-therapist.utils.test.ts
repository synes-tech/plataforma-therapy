/**
 * @vitest-environment node
 */
import { describe, it, expect } from 'vitest';
import { resolveTherapistSpecialty } from '@features/register/therapist-specialties';
import {
  buildSoloRegisterPayload,
  validateRegisterTherapistForm,
} from './register-therapist.utils';

describe('validateRegisterTherapistForm', () => {
  const base = {
    name: 'Ana Silva',
    phone: '',
    email: 'ana@email.com',
    confirm_email: 'ana@email.com',
    password: 'secret1',
    confirm_password: 'secret1',
    specialty_id: 'psicologia-infantil',
    specialty_other: '',
  };

  it('aceita formulário válido', () => {
    expect(validateRegisterTherapistForm(base)).toBeNull();
  });

  it('exige especialidade em Outros', () => {
    expect(
      validateRegisterTherapistForm({ ...base, specialty_id: 'outros', specialty_other: '' }),
    ).toBe('Informe sua especialidade em "Outros".');
  });
});

describe('buildSoloRegisterPayload', () => {
  it('mapeia e-mail único para login e consultório', () => {
    const payload = buildSoloRegisterPayload({
      name: 'Ana Silva',
      phone: '(11) 99999-0000',
      email: 'Ana@Email.com',
      confirm_email: 'ana@email.com',
      password: 'secret1',
      confirm_password: 'secret1',
      specialty_id: 'fonoaudiologia',
      specialty_other: '',
    }, 'http://localhost:5173/login?confirmed=1');

    expect(payload.account_type).toBe('solo');
    expect(payload.admin_email).toBe('ana@email.com');
    expect(payload.clinic_email).toBe('ana@email.com');
    expect(payload.specialty).toBe('Fonoaudiologia');
    expect(payload.email_redirect_to).toContain('confirmed=1');
  });
});

describe('resolveTherapistSpecialty', () => {
  it('usa texto livre em Outros', () => {
    expect(resolveTherapistSpecialty('outros', 'ABA')).toBe('ABA');
  });
});
