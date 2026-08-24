/**
 * @vitest-environment jsdom
 */
import { describe, expect, it, vi } from 'vitest';
import { render, screen } from '@testing-library/react';
import { TheryWelcomeModal } from './TheryWelcomeModal';

describe('TheryWelcomeModal', () => {
  it('mostra a boas-vindas da profissional e os dois caminhos', () => {
    const onStart = vi.fn();
    const onSkip = vi.fn();
    render(
      <TheryWelcomeModal
        isOpen
        audience="professional"
        firstName="João"
        onStart={onStart}
        onSkip={onSkip}
      />,
    );

    expect(screen.getByRole('dialog', { name: /oi, joão/i })).toBeInTheDocument();
    expect(screen.getByText(/agenda, do prontuário, do financeiro/i)).toBeInTheDocument();
    screen.getByRole('button', { name: 'Iniciar tutorial' }).click();
    expect(onStart).toHaveBeenCalledTimes(1);
    screen.getByRole('button', { name: 'Pular' }).click();
    expect(onSkip).toHaveBeenCalledTimes(1);
  });
});
