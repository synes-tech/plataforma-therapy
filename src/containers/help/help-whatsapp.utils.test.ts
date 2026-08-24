/**
 * @vitest-environment node
 */
import { describe, expect, it } from 'vitest';
import { HELP_WHATSAPP_E164, HELP_WHATSAPP_MESSAGE } from './help-contact.constants';
import {
  helpWhatsAppAppUrl,
  helpWhatsAppDesktopAppUrl,
  helpWhatsAppWebUrl,
  isHelpWhatsAppMobile,
} from './help-whatsapp.utils';

describe('help WhatsApp URLs', () => {
  it('abre o app com o número e a mensagem prontos', () => {
    const url = helpWhatsAppAppUrl();
    expect(url).toContain(`https://wa.me/${HELP_WHATSAPP_E164}`);
    expect(url).toContain(encodeURIComponent(HELP_WHATSAPP_MESSAGE));
  });

  it('abre o WhatsApp Web com o mesmo destino', () => {
    const url = helpWhatsAppWebUrl();
    expect(url).toContain('https://web.whatsapp.com/send');
    expect(url).toContain(`phone=${HELP_WHATSAPP_E164}`);
    expect(url).toContain(encodeURIComponent(HELP_WHATSAPP_MESSAGE));
  });

  it('usa o protocolo do aplicativo no computador', () => {
    expect(helpWhatsAppDesktopAppUrl()).toBe(
      `whatsapp://send?phone=${HELP_WHATSAPP_E164}&text=${encodeURIComponent(HELP_WHATSAPP_MESSAGE)}`,
    );
  });
});

describe('isHelpWhatsAppMobile', () => {
  it('reconhece celular e ignora desktop', () => {
    expect(isHelpWhatsAppMobile('Mozilla/5.0 (iPhone; CPU iPhone OS 17_0 like Mac OS X)')).toBe(true);
    expect(isHelpWhatsAppMobile('Mozilla/5.0 (Linux; Android 14; Pixel 8)')).toBe(true);
    expect(isHelpWhatsAppMobile('Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7)')).toBe(false);
    expect(isHelpWhatsAppMobile('Mozilla/5.0 (Windows NT 10.0; Win64; x64)')).toBe(false);
  });
});
