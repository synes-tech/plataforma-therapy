/**
 * @vitest-environment node
 */
import { describe, expect, it } from 'vitest';
import { postgrestErrorMessage } from '../../../supabase/functions/_shared/hard-delete-patient.utils.ts';

describe('postgrestErrorMessage', () => {
  it('lê message de Error', () => {
    expect(postgrestErrorMessage(new Error('financeiro_planos_paciente: fk'))).toBe(
      'financeiro_planos_paciente: fk',
    );
  });

  it('lê objeto Postgrest sem prototype de Error', () => {
    expect(postgrestErrorMessage({
      code: '23503',
      message: 'update or delete on table "patients" violates foreign key constraint',
      details: 'Key (id) is still referenced from table "copilot_threads".',
    })).toContain('copilot_threads');
  });
});
