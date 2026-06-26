import { AppError } from './errors.ts';

/** Dias retroativos permitidos para check-in familiar (ex.: esqueceu de registrar ontem). */
export const DIARY_MAX_RETROACTIVE_DAYS = 14;

export function todayEntryDateIso(): string {
  return new Date().toISOString().split('T')[0]!;
}

export function resolveEntryDate(entryDate?: string): string {
  return entryDate?.trim() || todayEntryDateIso();
}

export function validateDiaryEntryDate(entryDate: string): void {
  if (!/^\d{4}-\d{2}-\d{2}$/.test(entryDate)) {
    throw new AppError({
      code: 'VALIDATION_ERROR',
      message: 'Data do check-in inválida',
      statusCode: 400,
    });
  }

  const parsed = new Date(`${entryDate}T12:00:00`);
  if (Number.isNaN(parsed.getTime())) {
    throw new AppError({
      code: 'VALIDATION_ERROR',
      message: 'Data do check-in inválida',
      statusCode: 400,
    });
  }

  const today = new Date();
  today.setHours(12, 0, 0, 0);

  if (parsed.getTime() > today.getTime()) {
    throw new AppError({
      code: 'VALIDATION_ERROR',
      message: 'Não é possível registrar check-in em data futura',
      statusCode: 400,
    });
  }

  const oldest = new Date(today);
  oldest.setDate(oldest.getDate() - DIARY_MAX_RETROACTIVE_DAYS);

  if (parsed.getTime() < oldest.getTime()) {
    throw new AppError({
      code: 'VALIDATION_ERROR',
      message: `Só é possível registrar até ${DIARY_MAX_RETROACTIVE_DAYS} dias atrás`,
      statusCode: 400,
    });
  }
}
