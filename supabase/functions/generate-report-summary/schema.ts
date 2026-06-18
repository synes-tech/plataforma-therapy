import { z } from 'https://deno.land/x/zod@v3.23.8/mod.ts';

export const generateReportSummarySchema = z.object({
  session_note_id: z.string().uuid('session_note_id deve ser um UUID válido'),
});
