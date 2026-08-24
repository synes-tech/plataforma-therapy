import { z } from 'npm:zod@3.24.1';

export const CancelPatientSubscriptionSchema = z.object({
  action: z.enum(['preview', 'confirm']).optional().default('confirm'),
});

export type CancelPatientSubscriptionPayload = z.infer<typeof CancelPatientSubscriptionSchema>;
