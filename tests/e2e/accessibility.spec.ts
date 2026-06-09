/**
 * E2E Test: Accessibility (WCAG 2.2 AA)
 * Agente QA (5) - Section 4.7: Testes de Acessibilidade
 * Agente Frontend (1) - Section 4.3: WCAG 2.2 Nível AA
 */

import { test, expect } from '@playwright/test';
import AxeBuilder from '@axe-core/playwright';

test.describe('Accessibility — Login Page', () => {
  test('should have no WCAG violations on login page', async ({ page }) => {
    await page.goto('/login');

    const results = await new AxeBuilder({ page })
      .withTags(['wcag2a', 'wcag2aa', 'wcag22aa'])
      .analyze();

    expect(results.violations).toEqual([]);
  });

  test('should have proper focus management', async ({ page }) => {
    await page.goto('/login');

    // Tab through form elements
    await page.keyboard.press('Tab');
    const firstFocused = await page.evaluate(() => document.activeElement?.id);
    expect(firstFocused).toBe('email');

    await page.keyboard.press('Tab');
    const secondFocused = await page.evaluate(() => document.activeElement?.id);
    expect(secondFocused).toBe('password');
  });

  test('should have skip link for keyboard navigation', async ({ page }) => {
    await page.goto('/login');
    const skipLink = page.locator('.skip-link');
    await expect(skipLink).toBeAttached();
  });
});

test.describe('Accessibility — Register Page', () => {
  test('should have no WCAG violations on register page', async ({ page }) => {
    await page.goto('/register');

    const results = await new AxeBuilder({ page })
      .withTags(['wcag2a', 'wcag2aa'])
      .analyze();

    expect(results.violations).toEqual([]);
  });

  test('all form inputs should have associated labels', async ({ page }) => {
    await page.goto('/register');

    const inputs = page.locator('input');
    const count = await inputs.count();

    for (let i = 0; i < count; i++) {
      const input = inputs.nth(i);
      const id = await input.getAttribute('id');
      if (id) {
        const label = page.locator(`label[for="${id}"]`);
        await expect(label).toBeAttached();
      }
    }
  });
});
