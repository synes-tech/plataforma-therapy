/**
 * @vitest-environment jsdom
 */
import { fireEvent, render, screen } from '@testing-library/react';
import { describe, expect, it, vi } from 'vitest';
import { PatientListActionsMenu } from './PatientListActionsMenu';

describe('PatientListActionsMenu', () => {
  it('abre ACESSAR CENTRAL, EDITAR e DELETE ao clicar em Ações', () => {
    const onOpenCentral = vi.fn();
    const onEdit = vi.fn();
    const onDelete = vi.fn();
    render(
      <PatientListActionsMenu onOpenCentral={onOpenCentral} onEdit={onEdit} onDelete={onDelete} />,
    );

    fireEvent.click(screen.getByRole('button', { name: 'Ações' }));
    fireEvent.click(screen.getByRole('menuitem', { name: 'ACESSAR CENTRAL' }));
    expect(onOpenCentral).toHaveBeenCalledOnce();

    fireEvent.click(screen.getByRole('button', { name: 'Ações' }));
    fireEvent.click(screen.getByRole('menuitem', { name: 'EDITAR' }));
    expect(onEdit).toHaveBeenCalledOnce();

    fireEvent.click(screen.getByRole('button', { name: 'Ações' }));
    fireEvent.click(screen.getByRole('menuitem', { name: 'DELETE' }));
    expect(onDelete).toHaveBeenCalledOnce();
  });
});
