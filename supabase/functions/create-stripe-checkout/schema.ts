import { z } from 'npm:zod@3.24.1';

export const CreateStripeCheckoutSchema = z.object({
  plan_id: z.string().min(1),
  intent: z.enum(['subscribe', 'plan_change']).optional().default('subscribe'),
  billing_cycle: z.enum(['monthly', 'yearly']).optional().default('monthly'),
  addon_quantity: z.number().int().min(0).max(20).optional().default(0),
});

export type CreateStripeCheckoutPayload = z.infer<typeof CreateStripeCheckoutSchema>;
