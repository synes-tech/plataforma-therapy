import { z } from 'https://deno.land/x/zod@v3.23.8/mod.ts';

export const RegisterFamilySchema = z.object({
  name: z.string().min(2).max(100),
  email: z.string().email(),
  password: z.string().min(6).max(128),
  invite_code: z.string().min(6).max(8),
});
