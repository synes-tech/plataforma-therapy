import { z } from 'https://deno.land/x/zod@v3.23.8/mod.ts';

const soapContentSchema = z.object({
  subjective: z.string().max(5000).optional(),
  objective: z.string().max(5000).optional(),
  assessment: z.string().max(5000).optional(),
  plan: z.string().max(5000).optional(),
});

export const updateReportSchema = z.object({
  session_note_id: z.string().uuid('session_note_id deve ser um UUID válido'),
  content: soapContentSchema,
  approve: z.boolean().default(false),
});

export type UpdateReportInput = z.infer<typeof updateReportSchema>;
