import { render, screen } from '@testing-library/react';
import { describe, expect, it, vi } from 'vitest';
import { PatientRecordTabs } from './PatientRecordTabs';

describe('PatientRecordTabs', () => {
  it('estica as abas na largura total, como no financeiro', () => {
    render(<PatientRecordTabs active="copilot" onChange={vi.fn()} />);

    const tablist = screen.getByRole('tablist');
    expect(tablist.className).toContain('w-full');
    expect(screen.getByRole('tab', { name: 'Copiloto de IA' }).className).toContain('flex-1');
    expect(screen.getAllByRole('tab')).toHaveLength(6);
  });
});
