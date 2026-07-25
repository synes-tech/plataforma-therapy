import { z } from 'https://deno.land/x/zod@v3.23.8/mod.ts';

export const DeletePatientAttachmentSchema = z.object({
  patient_id: z.string().uuid(),
  attachment_id: z.string().uuid(),
});
