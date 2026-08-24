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

    const back = screen.getAllByRole('button', { name: 'Voltar para lista' })[0];
    expect(back).toBeTruthy();
    back.click();
    expect(onBack).toHaveBeenCalledOnce();
  });

  it('esconde o subtítulo no desktop', () => {
    render(<PageHeader title="Pacientes" subtitle="Gerencie seus pacientes" />);
    const subtitle = screen.getByText('Gerencie seus pacientes');
    expect(subtitle.className).toContain('lg:hidden');
  });

  it('usa título de 20px no desktop', () => {
    render(<PageHeader title="Agenda" />);
    expect(screen.getByRole('heading', { name: 'Agenda' }).className).toContain('lg:text-[20px]');
  });

  it('usa título curto no desktop quando desktopTitle é informado', () => {
    render(<PageHeader title="Agosto 2026" desktopTitle="Agenda" />);
    expect(screen.getByText('Agenda').className).toContain('lg:block');
    expect(screen.getByText('Agenda').className).toContain('text-[20px]');
    expect(screen.getByText('Agosto 2026').className).toContain('lg:hidden');
  });

  it('aplica sticky apenas no desktop', () => {
    const { container } = render(<PageHeader title="Teste" />);
    const header = container.querySelector('header');
    expect(header?.className).toContain('lg:sticky');
    expect(header?.className).toContain('lg:top-0');
    expect(header?.className).toContain('lg:z-40');
    expect(header?.className).not.toContain(' sticky ');
  });

  it('mantém uma linha no desktop sem empilhar título e ações', () => {
    const { container } = render(
      <PageHeader title="Agenda" actions={<button type="button">Hoje</button>} />,
    );
    const row = container.querySelector('header > div:last-of-type');
    expect(row?.className).toContain('lg:flex-nowrap');
    expect(row?.className).toContain('lg:h-14');
    expect(row?.className).toContain('lg:justify-start');
  });
});
