import { z } from 'https://deno.land/x/zod@v3.23.8/mod.ts';

export const RegisterClinicSchema = z
  .object({
    account_type: z.enum(['corporate', 'solo']),
    clinic_name: z.string().max(200).optional(),
    clinic_document: z.string().optional(),
    clinic_email: z.string().email(),
    clinic_phone: z.string().optional(),
    admin_name: z.string().min(2).max(100),
    admin_email: z.string().email(),
    admin_password: z.string().min(6).max(128),
    specialty: z.string().max(100).optional(),
  })
  .superRefine((data, ctx) => {
    const isSolo = data.account_type === 'solo';

    if (!isSolo && (!data.clinic_name || data.clinic_name.trim().length < 2)) {
      ctx.addIssue({
        code: z.ZodIssueCode.custom,
        message: 'Nome da clínica é obrigatório',
        path: ['clinic_name'],
      });
    }

    if (!isSolo && data.clinic_document && data.clinic_document.length > 20) {
      ctx.addIssue({
        code: z.ZodIssueCode.custom,
        message: 'CNPJ inválido',
        path: ['clinic_document'],
      });
    }
  });
