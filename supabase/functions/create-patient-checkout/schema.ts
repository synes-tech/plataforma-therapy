import { z } from 'npm:zod@3.24.1';

export const CreatePatientCheckoutSchema = z.object({
  success_path: z.string().startsWith('/').max(200).optional(),
}).optional().default({});

export type CreatePatientCheckoutPayload = z.infer<typeof CreatePatientCheckoutSchema>;
