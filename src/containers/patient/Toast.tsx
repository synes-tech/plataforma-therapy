import { useEffect } from 'react';

interface ToastProps {
  message: string;
  visible: boolean;
  onDismiss: () => void;
  variant?: 'success' | 'error';
}

export function Toast({ message, visible, onDismiss, variant = 'success' }: ToastProps) {
  useEffect(() => {
    if (!visible) return;
    const t = setTimeout(onDismiss, 3200);
    return () => clearTimeout(t);
  }, [visible, onDismiss]);

  if (!visible) return null;

  return (
    <div
      role="status"
      className={`fixed bottom-6 left-1/2 z-50 -translate-x-1/2 rounded-xl px-5 py-3 text-sm font-medium shadow-lg backdrop-blur-md ${
        variant === 'success'
          ? 'border border-mint/30 bg-mint-50/95 text-mint-dark'
          : 'border border-error/20 bg-error-light/95 text-error'
      }`}
    >
      {message}
    </div>
  );
}
