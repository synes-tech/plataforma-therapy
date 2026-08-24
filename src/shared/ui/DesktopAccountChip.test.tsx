/**
 * @vitest-environment jsdom
 */
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { fireEvent, render, screen } from '@testing-library/react';
import { describe, expect, it, vi } from 'vitest';
import { DesktopAccountChip } from './DesktopAccountChip';

describe('DesktopAccountChip', () => {
  it('mostra a foto, as iniciais e o botão de sair', () => {
    const onLogout = vi.fn();
    const client = new QueryClient({ defaultOptions: { queries: { retry: false } } });
    render(
      <QueryClientProvider client={client}>
        <DesktopAccountChip name="João Paulo" fotoUrl={null} onLogout={onLogout} />
      </QueryClientProvider>,
    );

    expect(screen.getAllByText('JP').length).toBeGreaterThan(0);
    fireEvent.click(screen.getByRole('button', { name: 'Sair da conta' }));
    expect(onLogout).toHaveBeenCalledOnce();
  });
});
