/** CPF brasileiro — normalização e validação de formato (11 dígitos). */

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

/** Mascara nome para resposta de busca (LGPD). Ex.: "Ana Silva" → "Ana S***" */
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
