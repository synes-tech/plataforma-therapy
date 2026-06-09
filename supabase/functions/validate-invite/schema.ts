import { z } from 'https://deno.land/x/zod@v3.23.8/mod.ts';

export const ValidateInviteSchema = z.object({
  code: z.string().length(8, 'Invite code must be exactly 8 characters'),
  name: z.string().min(2).max(100),
  email: z.string().email().optional(),
  phone: z.string().max(20).optional(),
});
