import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { render, screen } from '@testing-library/react';
import { describe, expect, it, vi } from 'vitest';
import { TherapistCopilotPatientsModal } from './TherapistCopilotPatientsModal';

function renderModal() {
  const client = new QueryClient({ defaultOptions: { queries: { retry: false } } });
  return render(
    <QueryClientProvider client={client}>
      <TherapistCopilotPatientsModal
        isOpen
        onClose={vi.fn()}
        onSelect={vi.fn()}
        patients={[
          {
            id: 'p1',
            name: 'Maria Fernanda Albuquerque de Souza Oliveira da Silva',
          },
        ]}
        selectLabel="Iniciar sessão com este paciente"
        selectShortLabel="Iniciar sessão"
      />
    </QueryClientProvider>,
  );
}

describe('TherapistCopilotPatientsModal', () => {
  it('abrevia o nome e mantém o botão de ação visível', () => {
    renderModal();

    const name = screen.getByText('Maria Fernanda Albuquerque de Souza Oliveira da Silva');
    expect(name.className).toContain('truncate');
    expect(name.className).toContain('min-w-0');

    const action = screen.getByRole('button', { name: /Iniciar sessão/ });
    expect(action.className).toContain('shrink-0');
    expect(screen.queryByRole('table')).toBeNull();
  });
});
