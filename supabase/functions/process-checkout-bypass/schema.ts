import { z } from 'https://deno.land/x/zod@v3.23.8/mod.ts';

export const ProcessCheckoutBypassSchema = z.object({
  plan_id: z.enum(['consultorio', 'starter', 'professional', 'enterprise']),
  card_holder_name: z.string().min(2).max(120).optional(),
  card_number: z.string().min(13).max(23).optional(),
  card_expiry: z.string().regex(/^\d{2}\/\d{2}$/).optional(),
  card_cvv: z.string().min(3).max(4).optional(),
});
