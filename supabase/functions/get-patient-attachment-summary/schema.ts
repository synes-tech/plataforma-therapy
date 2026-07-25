import { z } from 'npm:zod@3.24.1';

export const GetPatientAttachmentSummarySchema = z.object({
  patient_id: z.string().uuid(),
  attachment_id: z.string().uuid(),
});

export type GetPatientAttachmentSummaryPayload = z.infer<typeof GetPatientAttachmentSummarySchema>;
