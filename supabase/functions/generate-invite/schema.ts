import { z } from 'https://deno.land/x/zod@v3.23.8/mod.ts';
import { PORTAL_ACCESS_LEVELS } from '../_shared/patient-profile.ts';

export const GenerateInviteSchema = z.object({
  patient_id: z.string().uuid(),
  relationship: z.string().min(2).max(50).default('responsável'),
  expires_in_hours: z.number().int().min(1).max(168).default(72), // Max 7 days
  /**
   * Quando ausente, o backend deriva do perfil do paciente: adulto recebe SELF, menor
   * recebe CAREGIVER. Só é aceito explicitamente para casos legítimos como um segundo
   * cuidador de paciente adulto (TEA adulto com apoio familiar).
   */
  access_level: z.enum(PORTAL_ACCESS_LEVELS).optional(),
  /** Se informado, o convite é enviado por e-mail além de devolver o código na tela. */
  email: z
    .string()
    .max(254)
    .optional()
    .transform((v) => {
      if (v === undefined) return undefined;
      const t = v.trim().toLowerCase();
      return t.length > 0 ? t : null;
    })
    .refine((v) => v === undefined || v === null || /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(v), {
      message: 'E-mail inválido',
    }),
  name: z.string().max(200).optional().transform((v) => v?.trim() || undefined),
});
