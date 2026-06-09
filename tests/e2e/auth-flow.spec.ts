/**
 * E2E Test: Authentication Flow
 * Agente QA (5) - Section 4.3: Fluxo 1 — Onboarding Completo
 */

import { test, expect } from '@playwright/test';

test.describe('Authentication Flow', () => {
  test('should show login page with correct branding', async ({ page }) => {
    await page.goto('/login');
    await expect(page.getByRole('heading', { name: 'Therapy.AI' })).toBeVisible();
    await expect(page.getByLabel('Email')).toBeVisible();
    await expect(page.getByLabel('Senha')).toBeVisible();
    await expect(page.getByRole('button', { name: 'Entrar' })).toBeVisible();
  });

  test('should show error on invalid credentials', async ({ page }) => {
    await page.goto('/login');
    await page.getByLabel('Email').fill('invalid@test.com');
    await page.getByLabel('Senha').fill('wrongpassword');
    await page.getByRole('button', { name: 'Entrar' }).click();
    await expect(page.getByRole('alert')).toBeVisible();
  });

  test('should navigate to register clinic page', async ({ page }) => {
    await page.goto('/login');
    await page.getByText('Cadastrar clínica').click();
    await expect(page.getByRole('heading', { name: 'Cadastrar Clínica' })).toBeVisible();
  });

  test('should show register form with clinic and admin sections', async ({ page }) => {
    await page.goto('/register');
    await expect(page.getByLabel('Nome da Clínica')).toBeVisible();
    await expect(page.getByLabel('Email da Clínica')).toBeVisible();
    await expect(page.getByLabel('Seu Nome')).toBeVisible();
    await expect(page.getByLabel('Seu Email')).toBeVisible();
    await expect(page.getByLabel('Senha')).toBeVisible();
  });

  test('should redirect to login when accessing protected route unauthenticated', async ({ page }) => {
    await page.goto('/dashboard');
    await expect(page).toHaveURL('/login');
  });

  test('should show 404 for unknown routes', async ({ page }) => {
    await page.goto('/nonexistent-page');
    await expect(page.getByText('404')).toBeVisible();
  });
});
