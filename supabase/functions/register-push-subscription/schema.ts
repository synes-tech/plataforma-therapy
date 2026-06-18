import { z } from 'https://deno.land/x/zod@v3.23.8/mod.ts';

export const RegisterPushSchema = z.object({
  endpoint: z.string().url().max(2000),
  keys: z.object({
    p256dh: z.string().min(20).max(200),
    auth: z.string().min(10).max(100),
  }),
  user_agent: z.string().max(500).optional(),
});
