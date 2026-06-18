export interface CheckoutFormData {
  card_holder_name: string;
  card_number: string;
  card_expiry: string;
  card_cvv: string;
}

export interface CheckoutFieldErrors {
  card_holder_name?: string;
  card_number?: string;
  card_expiry?: string;
  card_cvv?: string;
}

export function digitsOnly(value: string): string {
  return value.replace(/\D/g, '');
}

export function formatCardNumber(value: string): string {
  const digits = digitsOnly(value).slice(0, 16);
  return digits.replace(/(\d{4})(?=\d)/g, '$1 ').trim();
}

export function formatCardExpiry(value: string): string {
  const digits = digitsOnly(value).slice(0, 4);
  if (digits.length <= 2) return digits;
  return `${digits.slice(0, 2)}/${digits.slice(2)}`;
}

export function validateCheckoutForm(data: CheckoutFormData): CheckoutFieldErrors {
  const errors: CheckoutFieldErrors = {};

  if (data.card_holder_name.trim().length < 2) {
    errors.card_holder_name = 'Informe o nome impresso no cartão';
  }

  const cardDigits = digitsOnly(data.card_number);
  if (cardDigits.length < 13 || cardDigits.length > 19) {
    errors.card_number = 'Número do cartão inválido';
  }

  const expiryMatch = data.card_expiry.match(/^(\d{2})\/(\d{2})$/);
  if (!expiryMatch) {
    errors.card_expiry = 'Use o formato MM/AA';
  } else {
    const month = Number(expiryMatch[1]);
    if (month < 1 || month > 12) {
      errors.card_expiry = 'Mês de validade inválido';
    }
  }

  const cvvDigits = digitsOnly(data.card_cvv);
  if (cvvDigits.length < 3 || cvvDigits.length > 4) {
    errors.card_cvv = 'CVV deve ter 3 ou 4 dígitos';
  }

  return errors;
}

export function isCheckoutFormValid(data: CheckoutFormData): boolean {
  return Object.keys(validateCheckoutForm(data)).length === 0;
}
