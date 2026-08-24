/**
 * @vitest-environment node
 */
import { describe, expect, it } from 'vitest';
import { EMPTY_INCOME_FORM, incomeFormToPayload, validateIncomeForm } from './income-form.schema';

describe('income-form.schema', () => {
  it('rejeita receita sem descrição ou valor', () => {
    expect(validateIncomeForm(EMPTY_INCOME_FORM).valid).toBe(false);
    expect(validateIncomeForm({ ...EMPTY_INCOME_FORM, descricao: 'Supervisão' }).valid).toBe(false);
  });

  it('aceita rendimento extra a receber sem paciente', () => {
    const future = new Date();
    future.setDate(future.getDate() + 5);
    const form = {
      ...EMPTY_INCOME_FORM,
      descricao: 'Supervisão externa',
      valor: '350,00',
      data_vencimento: future.toISOString().slice(0, 10),
    };
    expect(validateIncomeForm(form).valid).toBe(true);
    const payload = incomeFormToPayload(form);
    expect(payload.tipo).toBe('ENTRADA');
    expect(payload.paciente_id).toBeNull();
    expect(payload.status).toBe('PENDENTE');
    expect(payload.valor_cents).toBe(35000);
  });

  it('marca como pago quando já recebi', () => {
    const payload = incomeFormToPayload({
      ...EMPTY_INCOME_FORM,
      descricao: 'Palestra',
      valor: '100',
      data_vencimento: '2026-08-10',
      is_already_paid: true,
      forma_pagamento: 'pix',
    });
    expect(payload.status).toBe('PAGO');
    expect(payload.data_pagamento).toBe('2026-08-10');
  });
});
