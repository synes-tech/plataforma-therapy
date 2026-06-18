import { z } from 'https://deno.land/x/zod@v3.23.8/mod.ts';

export const CheckRemindersSchema = z.object({
  stale_after_days: z.number().int().min(1).max(14).default(2),
});
