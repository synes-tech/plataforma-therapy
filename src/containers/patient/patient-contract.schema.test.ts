/**
 * @vitest-environment node
 */
import { describe, expect, it } from 'vitest';
import { EMPTY_CONTRACT_FORM } from './PatientContractFields';
import {
  contractFormToPayload,
  contractSummary,
  contractToForm,
  validateContractForm,
} from './patient-contract.schema';

describe('patient-contract.schema', () => {
  it('bloqueia cadastro sem modelo e tipo de cobrança', () => {
    const result = validateContractForm(EMPTY_CONTRACT_FORM);
    expect(result.valid).toBe(false);
    expect(result.errors.model_type).toBeTruthy();
    expect(result.errors.billing_type).toBeTruthy();
  });

  it('avulso exige apenas o valor acordado', () => {
    const result = validateContractForm({
      ...EMPTY_CONTRACT_FORM,
      model_type: 'PARTICULAR',
      billing_type: 'AVULSO',
      valor: '180,00',
    });
    expect(result.valid).toBe(true);
    expect(result.errors).toEqual({});
  });

  it('mensal exige vencimento e sessões', () => {
    expect(
      validateContractForm({
        ...EMPTY_CONTRACT_FORM,
        model_type: 'CONVENIO',
        billing_type: 'MENSAL_RECORRENTE',
        valor: '800,00',
        due_day: '',
        sessions_per_month: '',
      }).valid,
    ).toBe(false);

    const ok = validateContractForm({
      ...EMPTY_CONTRACT_FORM,
      model_type: 'CONVENIO',
      billing_type: 'MENSAL_RECORRENTE',
      valor: '800,00',
      due_day: '10',
      sessions_per_month: '4',
    });
    expect(ok.valid).toBe(true);
  });

  it('pacote exige quantidade e valor do pacote', () => {
    expect(
      validateContractForm({
        ...EMPTY_CONTRACT_FORM,
        model_type: 'PARTICULAR',
        billing_type: 'PACOTE',
        pacote_qtd: '',
        pacote_valor: '',
      }).valid,
    ).toBe(false);

    expect(
      validateContractForm({
        ...EMPTY_CONTRACT_FORM,
        model_type: 'PARTICULAR',
        billing_type: 'PACOTE',
        pacote_qtd: '8',
        pacote_valor: '1.200,00',
      }).valid,
    ).toBe(true);
  });

  it('resume o contrato em uma linha para o terapeuta', () => {
    expect(
      contractSummary({
        ...EMPTY_CONTRACT_FORM,
        model_type: 'PARTICULAR',
        billing_type: 'MENSAL_RECORRENTE',
        valor: '800,00',
        due_day: '10',
        sessions_per_month: '4',
      }),
    ).toContain('Mensal');
    expect(contractSummary(EMPTY_CONTRACT_FORM)).toBeNull();
  });

  it('converte contrato da API para o formulário e de volta ao payload', () => {
    const form = contractToForm({
      model_type: 'PARTICULAR',
      billing_type: 'MENSAL_RECORRENTE',
      valor_acordado_cents: 80000,
      due_day: 10,
      sessions_per_month: 4,
      sessions_custom: false,
    });
    expect(form.due_day).toBe('10');
    const payload = contractFormToPayload('patient-1', form);
    expect(payload.action).toBe('upsert_plan');
    expect(payload.billing_type).toBe('MENSAL_RECORRENTE');
    expect(payload.valor_acordado_cents).toBe(80000);
    expect(payload.due_day).toBe(10);
  });
});
