import { render, screen } from '@testing-library/react';
import { describe, expect, it, vi } from 'vitest';
import { Reveal } from './landing-reveal';

describe('Reveal', () => {
  it('entra visível quando o usuário pede menos movimento', () => {
    vi.stubGlobal(
      'matchMedia',
      vi.fn().mockReturnValue({
        matches: true,
        addEventListener: vi.fn(),
        removeEventListener: vi.fn(),
      }),
    );

    const { container } = render(
      <Reveal from="right">
        <p>Conteúdo</p>
      </Reveal>,
    );

    expect(container.firstElementChild?.className).toContain('is-in');
    expect(screen.getByText('Conteúdo').textContent).toBe('Conteúdo');
    vi.unstubAllGlobals();
  });
});
