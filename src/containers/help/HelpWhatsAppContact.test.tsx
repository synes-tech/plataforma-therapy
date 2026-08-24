/**
 * @vitest-environment jsdom
 */
import { fireEvent, render, screen } from '@testing-library/react';
import { afterEach, describe, expect, it, vi } from 'vitest';
import { HELP_WHATSAPP_BUTTON_LABEL } from './help-contact.constants';
import { HelpWhatsAppContact } from './HelpWhatsAppContact';
import { helpWhatsAppAppUrl, helpWhatsAppDesktopAppUrl, helpWhatsAppWebUrl } from './help-whatsapp.utils';

describe('HelpWhatsAppContact', () => {
  afterEach(() => {
    vi.unstubAllGlobals();
    vi.restoreAllMocks();
  });

  it('no celular abre o WhatsApp com a mensagem pronta', () => {
    vi.stubGlobal('navigator', { userAgent: 'Mozilla/5.0 (iPhone; CPU iPhone OS 17_0 like Mac OS X)' });
    const assign = vi.fn();
    vi.stubGlobal('location', { assign });

    render(<HelpWhatsAppContact />);
    fireEvent.click(screen.getByRole('button', { name: HELP_WHATSAPP_BUTTON_LABEL }));

    expect(assign).toHaveBeenCalledWith(helpWhatsAppAppUrl());
    expect(screen.queryByRole('heading', { name: 'Abrir o WhatsApp' })).toBeNull();
  });

  it('no desktop pergunta se abre o aplicativo ou o WhatsApp Web', () => {
    vi.stubGlobal('navigator', { userAgent: 'Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7)' });

    render(<HelpWhatsAppContact />);
    fireEvent.click(screen.getByRole('button', { name: HELP_WHATSAPP_BUTTON_LABEL }));

    expect(screen.getByRole('heading', { name: 'Abrir o WhatsApp' })).toBeTruthy();
    expect(screen.getByRole('button', { name: 'WhatsApp Web' })).toBeTruthy();
    expect(screen.getByRole('button', { name: 'Aplicativo do computador' })).toBeTruthy();
  });

  it('no desktop abre o WhatsApp Web em nova aba', () => {
    vi.stubGlobal('navigator', { userAgent: 'Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7)' });
    const open = vi.fn();
    vi.stubGlobal('open', open);

    render(<HelpWhatsAppContact />);
    fireEvent.click(screen.getByRole('button', { name: HELP_WHATSAPP_BUTTON_LABEL }));
    fireEvent.click(screen.getByRole('button', { name: 'WhatsApp Web' }));

    expect(open).toHaveBeenCalledWith(helpWhatsAppWebUrl(), '_blank', 'noopener,noreferrer');
  });

  it('no desktop abre o aplicativo do computador', () => {
    vi.stubGlobal('navigator', { userAgent: 'Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7)' });
    const assign = vi.fn();
    vi.stubGlobal('location', { assign });

    render(<HelpWhatsAppContact />);
    fireEvent.click(screen.getByRole('button', { name: HELP_WHATSAPP_BUTTON_LABEL }));
    fireEvent.click(screen.getByRole('button', { name: 'Aplicativo do computador' }));

    expect(assign).toHaveBeenCalledWith(helpWhatsAppDesktopAppUrl());
  });
});
