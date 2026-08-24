import { useState } from 'react';
import { StandardModal } from '@shared/ui/StandardModal';
import { HELP_WHATSAPP_BUTTON_LABEL, HELP_WHATSAPP_MESSAGE } from './help-contact.constants';
import {
  helpWhatsAppAppUrl,
  helpWhatsAppDesktopAppUrl,
  helpWhatsAppWebUrl,
  isHelpWhatsAppMobile,
} from './help-whatsapp.utils';

function WhatsAppLogo({ className = 'h-4 w-4' }: { className?: string }) {
  return (
    <svg className={`shrink-0 ${className}`} viewBox="0 0 24 24" fill="currentColor" aria-hidden>
      <path d="M12.04 2C6.5 2 2 6.49 2 12.02c0 1.77.46 3.5 1.34 5.02L2 22l5.06-1.32A10.02 10.02 0 0 0 12.04 22C17.58 22 22.08 17.51 22.08 12S17.58 2 12.04 2zm0 18.15c-1.64 0-3.25-.44-4.65-1.27l-.33-.2-3.01.79.8-2.93-.22-.34A8.13 8.13 0 0 1 3.87 12c0-4.5 3.67-8.16 8.17-8.16 4.5 0 8.17 3.66 8.17 8.16 0 4.5-3.67 8.15-8.17 8.15z" />
      <path d="M17.47 14.38c-.3-.15-1.76-.87-2.03-.97-.27-.1-.47-.15-.67.15-.2.3-.77.97-.94 1.16-.17.2-.35.22-.64.08-.3-.15-1.26-.46-2.4-1.48-.88-.79-1.48-1.76-1.65-2.06-.17-.3-.02-.46.13-.6.13-.13.3-.35.45-.52.14-.17.2-.3.3-.5.1-.2.05-.37-.02-.52-.08-.15-.67-1.61-.92-2.21-.24-.58-.49-.5-.67-.51-.17-.01-.37-.01-.57-.01s-.52.07-.79.37c-.27.3-1.04 1.02-1.04 2.48 0 1.46 1.07 2.88 1.21 3.07.15.2 2.1 3.2 5.08 4.49.71.3 1.26.49 1.69.62.71.23 1.36.2 1.87.12.57-.09 1.76-.72 2.01-1.41.25-.7.25-1.29.17-1.41-.07-.13-.27-.2-.57-.35z" />
    </svg>
  );
}

function openUrl(url: string, newTab: boolean) {
  if (newTab) {
    window.open(url, '_blank', 'noopener,noreferrer');
    return;
  }
  window.location.assign(url);
}

export function HelpWhatsAppContact() {
  const [chooserOpen, setChooserOpen] = useState(false);

  function handleClick() {
    if (isHelpWhatsAppMobile(navigator.userAgent)) {
      openUrl(helpWhatsAppAppUrl(), false);
      return;
    }
    setChooserOpen(true);
  }

  function openDesktopApp() {
    setChooserOpen(false);
    openUrl(helpWhatsAppDesktopAppUrl(), false);
  }

  function openWeb() {
    setChooserOpen(false);
    openUrl(helpWhatsAppWebUrl(), true);
  }

  return (
    <>
      <button
        type="button"
        onClick={handleClick}
        className="inline-flex h-8 max-w-full shrink-0 items-center gap-1.5 rounded-lg bg-[#25D366] px-2.5 text-[11px] font-semibold leading-none text-white shadow-sm transition-colors hover:bg-[#1EBE5A] active:scale-[0.98]"
      >
        <WhatsAppLogo className="h-3.5 w-3.5" />
        <span className="truncate">{HELP_WHATSAPP_BUTTON_LABEL}</span>
      </button>

      <StandardModal
        isOpen={chooserOpen}
        onClose={() => setChooserOpen(false)}
        title="Abrir o WhatsApp"
        size="md"
        footer={
          <>
            <button
              type="button"
              onClick={openWeb}
              className="inline-flex h-11 w-full items-center justify-center rounded-xl border border-slate-200 bg-white px-5 text-sm font-medium text-charcoal md:w-auto"
            >
              WhatsApp Web
            </button>
            <button
              type="button"
              onClick={openDesktopApp}
              className="inline-flex h-11 w-full items-center justify-center gap-2 rounded-xl bg-[#25D366] px-5 text-sm font-semibold text-white hover:bg-[#1EBE5A] md:w-auto"
            >
              <WhatsAppLogo className="h-5 w-5" />
              Aplicativo do computador
            </button>
          </>
        }
      >
        <p className="text-sm leading-relaxed text-charcoal-muted">
          Como você prefere continuar? A conversa já abre com a mensagem
          {' '}
          <span className="font-medium text-charcoal">“{HELP_WHATSAPP_MESSAGE}”</span>
          .
        </p>
      </StandardModal>
    </>
  );
}
