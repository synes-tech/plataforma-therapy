import { z } from 'https://deno.land/x/zod@v3.23.8/mod.ts';

export const AcknowledgeClinicalAlertSchema = z.object({
  alert_id: z.string().uuid(),
});

export type AcknowledgeClinicalAlertPayload = z.infer<typeof AcknowledgeClinicalAlertSchema>;
