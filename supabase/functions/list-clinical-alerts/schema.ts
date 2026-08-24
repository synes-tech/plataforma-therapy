import { z } from 'https://deno.land/x/zod@v3.23.8/mod.ts';

export const ListClinicalAlertsSchema = z.object({
  status: z.enum(['UNREAD', 'ACKNOWLEDGED', 'RESOLVED']).optional(),
  limit: z.number().int().min(1).max(100).optional(),
});

export type ListClinicalAlertsPayload = z.infer<typeof ListClinicalAlertsSchema>;
