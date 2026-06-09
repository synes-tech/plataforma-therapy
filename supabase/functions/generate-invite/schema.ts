import { z } from 'https://deno.land/x/zod@v3.23.8/mod.ts';

export const GenerateInviteSchema = z.object({
  patient_id: z.string().uuid(),
  relationship: z.string().min(2).max(50).default('responsável'),
  expires_in_hours: z.number().int().min(1).max(168).default(72), // Max 7 days
});
