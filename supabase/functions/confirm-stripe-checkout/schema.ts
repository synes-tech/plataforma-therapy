import { z } from 'npm:zod@3.24.1';

export const ConfirmStripeCheckoutSchema = z.object({
  session_id: z.string().min(1),
});

export type ConfirmStripeCheckoutPayload = z.infer<typeof ConfirmStripeCheckoutSchema>;
