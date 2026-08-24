import { render, screen } from '@testing-library/react';
import { describe, expect, it, vi } from 'vitest';
import { IvyWelcomeHero } from './IvyWelcomeHero';
import { ivyConfettiPieces } from './ivy-welcome.utils';

describe('IvyWelcomeHero', () => {
  it('mostra a Ivy feliz e dispara a apresentação ao clicar', () => {
    const onReplay = vi.fn();
    const { container } = render(<IvyWelcomeHero bursting runId={1} onReplay={onReplay} />);

    expect(screen.getByRole('button', { name: 'Ver apresentação da Ivy' })).toBeTruthy();
    expect(container.querySelector('img')?.getAttribute('src') ?? '').toMatch(/thery|happy|braco/i);
    expect(container.querySelectorAll('.ivy-confetti-piece')).toHaveLength(ivyConfettiPieces().length);

    screen.getByRole('button', { name: 'Ver apresentação da Ivy' }).click();
    expect(onReplay).toHaveBeenCalledOnce();
  });
});
