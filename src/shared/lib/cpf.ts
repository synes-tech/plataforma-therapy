/** CPF brasileiro — normalização e validação (compartilhado com Edge Functions). */

export function normalizeCpf(raw: string): string {
  return raw.replace(/\D/g, '');
}

export function isValidCpfFormat(cpf: string): boolean {
  const digits = normalizeCpf(cpf);
  if (digits.length !== 11) return false;
  if (/^(\d)\1{10}$/.test(digits)) return false;

  const calcDigit = (base: string, factor: number): number => {
    let sum = 0;
    for (let i = 0; i < base.length; i++) {
      sum += Number(base[i]) * (factor - i);
    }
    const mod = (sum * 10) % 11;
    return mod === 10 ? 0 : mod;
  };

  const d1 = calcDigit(digits.slice(0, 9), 10);
  const d2 = calcDigit(digits.slice(0, 10), 11);
  return d1 === Number(digits[9]) && d2 === Number(digits[10]);
}

export function maskPatientName(fullName: string): string {
  const parts = fullName.trim().split(/\s+/).filter(Boolean);
  if (parts.length === 0) return '***';
  if (parts.length === 1) {
    const only = parts[0]!;
    return only.length <= 2 ? `${only[0]}***` : `${only.slice(0, 2)}***`;
  }
  const first = parts[0]!;
  const last = parts[parts.length - 1]!;
  return `${first} ${last[0]}***`;
}

export function formatCpfDisplay(cpf: string): string {
  const d = normalizeCpf(cpf);
  if (d.length !== 11) return cpf;
  return `${d.slice(0, 3)}.${d.slice(3, 6)}.${d.slice(6, 9)}-${d.slice(9)}`;
}

/** Máscara progressiva para input controlado (000.000.000-00). */
export function maskCpfInput(raw: string): string {
  const d = normalizeCpf(raw).slice(0, 11);
  if (d.length <= 3) return d;
  if (d.length <= 6) return `${d.slice(0, 3)}.${d.slice(3)}`;
  if (d.length <= 9) return `${d.slice(0, 3)}.${d.slice(3, 6)}.${d.slice(6)}`;
  return `${d.slice(0, 3)}.${d.slice(3, 6)}.${d.slice(6, 9)}-${d.slice(9)}`;
}

export function cpfDigitsComplete(cpf: string): boolean {
  return normalizeCpf(cpf).length === 11;
}
