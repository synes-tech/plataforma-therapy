import { z } from 'npm:zod@3.24.1';

export const CancelSubscriptionSchema = z.object({
  /** preview: só calcula efeitos; confirm: executa o cancelamento. */
  action: z.enum(['preview', 'confirm']).default('preview'),
  /** Obrigatório no confirm quando há multa de fidelidade do ciclo anual. */
  accept_fidelity_adjustment: z.boolean().optional().default(false),
});

export type CancelSubscriptionPayload = z.infer<typeof CancelSubscriptionSchema>;
