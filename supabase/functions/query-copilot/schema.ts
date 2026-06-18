import { z } from 'https://deno.land/x/zod@v3.23.8/mod.ts';

export const QueryCopilotSchema = z.object({
  patient_id: z.string().uuid(),
  message: z.string().min(3).max(2000),
  stream: z.boolean().optional(),
  conversation_history: z.array(z.object({
    role: z.enum(['user', 'assistant']),
    content: z.string(),
  })).max(10).optional(),
});
