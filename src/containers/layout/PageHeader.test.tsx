import { describe, expect, it, vi } from 'vitest';
import { render, screen } from '@testing-library/react';
import { PageHeader } from './PageHeader';

describe('PageHeader', () => {
  it('renderiza título, subtítulo e ações', () => {
    render(
      <PageHeader
        title="Pacientes"
        subtitle="Gerencie seus pacientes"
        actions={<button type="button">Novo</button>}
        tabs={<nav aria-label="tabs">Aba</nav>}
      />,
    );

    expect(screen.getByRole('heading', { name: 'Pacientes' })).toBeTruthy();
    expect(screen.getByText('Gerencie seus pacientes')).toBeTruthy();
    expect(screen.getByRole('button', { name: 'Novo' })).toBeTruthy();
    expect(screen.getByLabelText('tabs')).toBeTruthy();
  });

  it('renderiza botão de voltar quando informado', () => {
    const onBack = vi.fn();
    render(
      <PageHeader
        title="Detalhe"
        backButton={{ onClick: onBack, label: 'Voltar para lista' }}
      />,
    );

    const back = screen.getByRole('button', { name: 'Voltar para lista' });
    expect(back).toBeTruthy();
    back.click();
    expect(onBack).toHaveBeenCalledOnce();
  });

  it('aplica classes sticky e z-index', () => {
    const { container } = render(<PageHeader title="Teste" />);
    const header = container.querySelector('header');
    expect(header?.className).toContain('sticky');
    expect(header?.className).toContain('top-0');
    expect(header?.className).toContain('z-40');
  });
});
