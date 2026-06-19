import { describe, expect, it } from 'vitest';
import { render, screen } from '@testing-library/react';
import { Spinner } from './Spinner';
import { LoadingButton } from './LoadingButton';

describe('Spinner', () => {
  it('expõe status acessível', () => {
    render(<Spinner label="Aguarde" />);
    expect(screen.getByRole('status', { name: 'Aguarde' })).toBeTruthy();
  });
});

describe('LoadingButton', () => {
  it('mostra spinner e desabilita quando loading', () => {
    render(
      <LoadingButton loading loadingLabel="Salvando">
        Salvar
      </LoadingButton>,
    );
    const button = screen.getByRole('button');
    expect(button.hasAttribute('disabled')).toBe(true);
    expect(button.getAttribute('aria-busy')).toBe('true');
    expect(screen.getByText('Salvando')).toBeTruthy();
  });
});
