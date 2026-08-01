import { z } from 'https://deno.land/x/zod@v3.23.8/mod.ts';

const reportContentSchema = z.object({
  clinical_synthesis: z.string().max(5000).optional(),
  patient_reports: z.string().max(5000).optional(),
  clinical_observations: z.string().max(5000).optional(),
  management_next_steps: z.string().max(5000).optional(),
  // Legado SOAP (edição de sessões antigas)
  subjective: z.string().max(5000).optional(),
  objective: z.string().max(5000).optional(),
  assessment: z.string().max(5000).optional(),
  plan: z.string().max(5000).optional(),
  summary_markdown: z.string().max(20000).optional(),
});

export const updateReportSchema = z.object({
  session_note_id: z.string().uuid('session_note_id deve ser um UUID válido'),
  content: reportContentSchema,
  approve: z.boolean().default(false),
});

export type UpdateReportInput = z.infer<typeof updateReportSchema>;
