/**
 * E2E — Sessão Dual Multimodal (Fase 3)
 * Requer credenciais E2E_PROFESSIONAL_EMAIL / E2E_PROFESSIONAL_PASSWORD no CI.
 */
import { test, expect } from '@playwright/test';

const professionalEmail = process.env.E2E_PROFESSIONAL_EMAIL;
const professionalPassword = process.env.E2E_PROFESSIONAL_PASSWORD;
const patientId = process.env.E2E_PATIENT_ID;

test.describe('Clinical Session Workspace', () => {
  test.skip(
    !professionalEmail || !professionalPassword || !patientId,
    'Defina E2E_PROFESSIONAL_EMAIL, E2E_PROFESSIONAL_PASSWORD e E2E_PATIENT_ID',
  );

  test.beforeEach(async ({ page }) => {
    await page.goto('/login');
    await page.getByLabel('Email').fill(professionalEmail!);
    await page.getByLabel('Senha').fill(professionalPassword!);
    await page.getByRole('button', { name: 'Entrar' }).click();
    await expect(page).not.toHaveURL('/login');
  });

  test('workspace multimodal exibe editor e botão unificado', async ({ page }) => {
    await page.goto(`/session/${patientId}`);
    await expect(page.getByRole('heading', { name: 'Sessão clínica' })).toBeVisible();
    await expect(page.getByRole('heading', { name: 'Workspace clínico' })).toBeVisible();
    await expect(page.getByRole('heading', { name: 'Anotações da sessão' })).toBeVisible();
    await expect(page.getByRole('button', { name: 'Finalizar e Processar Sessão' })).toBeVisible();
    await expect(page.getByRole('button', { name: 'Iniciar gravação' })).toBeVisible();
  });

  test('fluxo texto-only leva à lapidação', async ({ page }) => {
    await page.goto(`/session/${patientId}`);
    const editor = page.getByRole('textbox', { name: /Revisão do relatório|Anotações/i }).first();
    await page.locator('#session-notes-editor-title').scrollIntoViewIfNeeded();
    await page.locator('textarea').first().fill(
      'Sessão E2E: paciente colaborativo, trabalhamos regulação emocional e combinados com família.',
    );
    await page.getByRole('button', { name: 'Finalizar e Processar Sessão' }).click();
    await expect(page.getByText(/estruturando relatório|Processando sessão/i)).toBeVisible();
    await expect(page.getByRole('heading', { name: 'Revisão e aprovação' })).toBeVisible({
      timeout: 120_000,
    });
    await expect(page.getByRole('button', { name: '🔒 Salvar como Prontuário Privado' })).toBeVisible();
  });
});
