import { render, screen } from '@testing-library/react';
import { describe, expect, it } from 'vitest';
import { DashboardHero } from './DashboardHero';

describe('DashboardHero', () => {
  it('mostra a Ivy ao lado do cumprimento', () => {
    const { container } = render(<DashboardHero firstName="João" greeting="Boa tarde" date="2026-08-24" />);
    expect(screen.getByRole('heading', { name: 'Boa tarde, João.' })).toBeTruthy();
    expect(container.querySelector('img')).toBeTruthy();
    expect(container.querySelector('span.rounded-full')).toBeTruthy();
  });

  it('compacta o cumprimento na barra do desktop', () => {
    render(<DashboardHero compact firstName="João" greeting="Boa tarde" />);
    const heading = screen.getByRole('heading', { name: 'Boa tarde, João' });
    expect(heading.className).toContain('text-[20px]');
  });
});
