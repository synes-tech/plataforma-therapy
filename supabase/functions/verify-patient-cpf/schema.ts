import { z } from 'https://deno.land/x/zod@v3.23.8/mod.ts';

export const VerifyPatientCpfSchema = z.object({
  cpf: z.string().min(11).max(14),
});
