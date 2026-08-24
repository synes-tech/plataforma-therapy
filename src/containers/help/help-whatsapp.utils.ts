import { HELP_WHATSAPP_E164, HELP_WHATSAPP_MESSAGE } from './help-contact.constants';

export function helpWhatsAppAppUrl(
  phone = HELP_WHATSAPP_E164,
  text = HELP_WHATSAPP_MESSAGE,
): string {
  return `https://wa.me/${phone}?text=${encodeURIComponent(text)}`;
}

export function helpWhatsAppWebUrl(
  phone = HELP_WHATSAPP_E164,
  text = HELP_WHATSAPP_MESSAGE,
): string {
  return `https://web.whatsapp.com/send?phone=${phone}&text=${encodeURIComponent(text)}`;
}

export function helpWhatsAppDesktopAppUrl(
  phone = HELP_WHATSAPP_E164,
  text = HELP_WHATSAPP_MESSAGE,
): string {
  return `whatsapp://send?phone=${phone}&text=${encodeURIComponent(text)}`;
}

export function isHelpWhatsAppMobile(userAgent: string): boolean {
  return /Android|webOS|iPhone|iPad|iPod|BlackBerry|IEMobile|Opera Mini|Mobile/i.test(userAgent);
}
