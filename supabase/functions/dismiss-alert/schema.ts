import { z } from 'https://deno.land/x/zod@v3.23.8/mod.ts';

export const DismissAlertSchema = z.object({
  diary_entry_id: z.string().uuid(),
});
