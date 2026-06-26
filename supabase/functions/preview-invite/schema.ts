import { z } from 'https://deno.land/x/zod@v3.23.8/mod.ts';

export const PreviewInviteSchema = z.object({
  code: z.string().trim().length(8, 'Invite code must be exactly 8 characters'),
});
