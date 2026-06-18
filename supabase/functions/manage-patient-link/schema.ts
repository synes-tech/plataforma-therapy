import { z } from 'https://deno.land/x/zod@v3.23.8/mod.ts';

export const ManagePatientLinkSchema = z.object({
  patient_id: z.string().uuid(),
  acao: z.enum(['unlink', 'delete']),
  /** Obrigatório para delete — confirmação dupla no frontend */
  confirm_name: z.string().min(1).max(200).optional(),
});
