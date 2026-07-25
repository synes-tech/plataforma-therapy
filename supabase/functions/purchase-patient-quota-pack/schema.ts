import { z } from 'https://deno.land/x/zod@v3.23.8/mod.ts';

export const PurchasePatientQuotaPackSchema = z.object({
  /** Quantidade de Módulos Adicionais (+5 pacientes cada) a acrescentar. */
  quantity: z.number().int().min(1).max(10).optional().default(1),
});
