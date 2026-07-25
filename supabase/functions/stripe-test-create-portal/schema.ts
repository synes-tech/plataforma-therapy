import { z } from 'https://deno.land/x/zod@v3.23.8/mod.ts';

export const StripeTestCreatePortalSchema = z.object({
  session_id: z.string().min(8).max(200),
  mode: z.enum(['test', 'live']),
});
