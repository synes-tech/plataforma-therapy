import { z } from 'https://deno.land/x/zod@v3.23.8/mod.ts';

export const PurchaseAddonBypassSchema = z.object({
  quantidade_comprada: z
    .number()
    .int()
    .min(5)
    .max(100)
    .refine((n) => n % 5 === 0, { message: 'Quantidade deve ser múltiplo de 5' }),
});
