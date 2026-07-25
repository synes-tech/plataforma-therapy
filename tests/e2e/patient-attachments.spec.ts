/**
 * E2E — Anexos do paciente + base de conhecimento IA
 * Requer E2E_PROFESSIONAL_EMAIL, E2E_PROFESSIONAL_PASSWORD e E2E_PATIENT_ID.
 */
import { test, expect } from '@playwright/test';
import path from 'path';
import { fileURLToPath } from 'url';

const professionalEmail = process.env.E2E_PROFESSIONAL_EMAIL;
const professionalPassword = process.env.E2E_PROFESSIONAL_PASSWORD;
const patientId = process.env.E2E_PATIENT_ID;

const __dirname = path.dirname(fileURLToPath(import.meta.url));

test.describe('Patient attachments', () => {
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

  test('aba Documentos exibe painel de anexos e upload', async ({ page }) => {
    await page.goto(`/patients/${patientId}/documents`);
    await expect(page.getByRole('heading', { name: 'Anexos e base de conhecimento' })).toBeVisible();
    await expect(page.getByText('Selecionar arquivos')).toBeVisible();
    await expect(page.getByRole('heading', { name: 'Documentos salvos pelo Copiloto' })).toBeVisible();
  });

  test('upload de TXT aparece na lista com status Pronto', async ({ page }) => {
    const fixturePath = path.join(__dirname, '../fixtures/patient-attachment-e2e.txt');
    const uniqueName = `e2e-anexo-${Date.now()}.txt`;

    await page.goto(`/patients/${patientId}/documents`);
    const fileInput = page.locator('input[type="file"]').first();
    await fileInput.setInputFiles({
      name: uniqueName,
      mimeType: 'text/plain',
      buffer: Buffer.from(
        'Relatório E2E: paciente apresenta boa adaptação escolar e regulação emocional em atividades guiadas.',
      ),
    });

    await expect(page.getByText(uniqueName)).toBeVisible({ timeout: 90_000 });
    await expect(page.getByText('Pronto')).toBeVisible();
    await expect(page.getByText(/trechos na base IA/i)).toBeVisible();
  });
});
