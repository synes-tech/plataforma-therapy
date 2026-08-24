/**
 * Caminho dourado B2B+B2C — roteiro Playwright.
 *
 * Os três cenários clínicos rodam de verdade nas camadas abaixo (não dependem de
 * login E2E nem da Vertex):
 *   1. Isolamento RLS  → `npm run test:rls`
 *   2. Guardrail SEVERE → `src/shared/lib/b2c-billing.test.ts` + companion-brain
 *   3. Onboarding SELF  → `universal-onboarding.test.ts` + portal-diary
 *
 * Este spec trava o contrato de UI pública e documenta o fluxo autenticado.
 * O checkout Stripe real só corre quando E2E_PORTAL_EMAIL / E2E_PORTAL_PASSWORD
 * existem — nunca inventamos cartão nem burla de paywall.
 */
import { test, expect } from '@playwright/test';

const GOLDEN_CRISIS = 'Não aguento mais, quero sumir do mapa, vou acabar com tudo.';

test.describe('Caminho dourado B2C — contrato público', () => {
  test('login do portal continua acessível', async ({ page }) => {
    await page.goto('/login');
    await expect(page.getByAltText('Unithery')).toBeVisible();
    await expect(page.getByLabel('Email')).toBeVisible();
  });
});

test.describe('Caminho dourado B2C — portal autenticado', () => {
  test.skip(!process.env.E2E_PORTAL_EMAIL || !process.env.E2E_PORTAL_PASSWORD, 'sem credencial de portal');

  test('adulto SELF vê slider de Humor e não vê Agitação', async ({ page }) => {
    await page.goto('/login');
    await page.getByLabel('Email').fill(process.env.E2E_PORTAL_EMAIL!);
    await page.getByLabel('Senha').fill(process.env.E2E_PORTAL_PASSWORD!);
    await page.getByRole('button', { name: 'Entrar' }).click();

    await page.goto('/portal/diary');
    await expect(page.getByText('Como está seu humor?')).toBeVisible();
    await expect(page.getByText('Agitação', { exact: true })).toHaveCount(0);

    await page.goto('/portal/agreements');
    await expect(page.getByRole('heading', { name: /Ivy|Plano de cuidados/i })).toBeVisible();
  });

  test('frase de crise no apoio dispara protocolo com 188', async ({ page }) => {
    await page.goto('/login');
    await page.getByLabel('Email').fill(process.env.E2E_PORTAL_EMAIL!);
    await page.getByLabel('Senha').fill(process.env.E2E_PORTAL_PASSWORD!);
    await page.getByRole('button', { name: 'Entrar' }).click();

    await page.goto('/portal/ivy');
    const input = page.getByRole('textbox');
    await input.fill(GOLDEN_CRISIS);
    await page.getByRole('button', { name: /enviar|mandar/i }).click();
    await expect(page.getByText('188')).toBeVisible({ timeout: 15_000 });
    await expect(page.getByText(/CVV/i)).toBeVisible();
  });
});
