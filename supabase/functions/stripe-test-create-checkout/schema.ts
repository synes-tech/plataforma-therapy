import { z } from 'https://deno.land/x/zod@v3.23.8/mod.ts';

export const StripeTestCreateCheckoutSchema = z.object({
  mode: z.enum(['test', 'live']),
  plan_id: z.enum(['inicial', 'intermediario', 'teste_1_real']),
  lookup_key: z.string().min(1).max(120).optional(),
});
