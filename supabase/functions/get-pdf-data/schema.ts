import { z } from 'https://deno.land/x/zod@v3.23.8/mod.ts';

export const PdfExportSchema = z.object({
  patient_id: z.string().uuid('patient_id deve ser um UUID válido'),
});
