import { describe, expect, it } from 'vitest';
import type { ClinicalAlertItem } from './clinical-alerts.types';
import {
  clinicalAlertSourceLabel,
  clinicalAlertsButtonLabel,
  clinicalAlertsButtonTone,
  clinicalRecordPath,
  formatAlertOccurredAt,
  newSevereAlertIds,
  shouldToastSevereAlert,
} from './clinical-alerts.utils';

function alert(partial: Partial<ClinicalAlertItem>): ClinicalAlertItem {
  return {
    id: 'a1',
    patient_id: 'p1',
    patient_name: 'Ana',
    patient_foto_url: null,
    clinic_id: 'c1',
    professional_id: 'pr1',
    source: 'COPILOT_B2C',
    severity: 'SEVERE',
    status: 'UNREAD',
    title: 'Risco de vida sinalizado no Acompanhante',
    summary: 'O paciente sinalizou risco de vida no chat da Ivy.',
    source_ref_id: null,
    occurred_at: '2026-08-22T06:00:00.000Z',
    notify_now: true,
    metadata: {},
    ...partial,
  };
}

describe('clinical-alerts.utils', () => {
  it('rotula origem sem expor o chat', () => {
    expect(clinicalAlertSourceLabel('COPILOT_B2C')).toBe('Acompanhante IA');
    expect(clinicalAlertSourceLabel('DIARY')).toBe('Diário de humor');
    expect(clinicalRecordPath('p1')).toBe('/patients/p1/copilot');
  });

  it('só toasta SEVERE não lido', () => {
    expect(shouldToastSevereAlert(alert({}))).toBe(true);
    expect(shouldToastSevereAlert(alert({ severity: 'MODERATE', notify_now: true }))).toBe(false);
    expect(shouldToastSevereAlert(alert({ status: 'ACKNOWLEDGED' }))).toBe(false);
  });

  it('não toasta de novo o que o terapeuta já viu nesta sessão', () => {
    const incoming = [alert({ id: 'old' }), alert({ id: 'new' })];
    expect(newSevereAlertIds(incoming, new Set(['old']))).toEqual(['new']);
  });

  it('formata horário relativo', () => {
    const now = new Date('2026-08-22T07:10:00.000Z');
    expect(formatAlertOccurredAt('2026-08-22T06:10:00.000Z', now)).toBe('há 1 hora');
  });

  it('rotula o botão no singular e no plural', () => {
    expect(clinicalAlertsButtonLabel(1)).toBe('Atenção, você tem 1 alerta');
    expect(clinicalAlertsButtonLabel(3)).toBe('Atenção, você tem 3 alertas');
  });

  it('fica vermelho se houver urgente, amarelo nos demais', () => {
    expect(clinicalAlertsButtonTone(1)).toBe('severe');
    expect(clinicalAlertsButtonTone(0)).toBe('attention');
  });
});
