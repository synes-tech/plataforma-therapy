import { z } from 'https://deno.land/x/zod@v3.23.8/mod.ts';

export const QueryPatientCompanionSchema = z.object({
  message: z.string().min(1).max(2000),
  stream: z.boolean().optional(),
  input_source: z.enum(['text', 'audio']).optional(),
});

export type QueryPatientCompanionPayload = z.infer<typeof QueryPatientCompanionSchema>;
