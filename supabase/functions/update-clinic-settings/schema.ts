import { z } from 'https://deno.land/x/zod@v3.23.8/mod.ts';

export const UpdateClinicSettingsSchema = z.object({
  clinic: z
    .object({
      name: z.string().trim().min(2).max(120).optional(),
      email: z.string().trim().email().max(160).optional(),
      phone: z.string().trim().max(40).optional().or(z.literal('')),
      document: z.string().trim().max(32).optional().or(z.literal('')),
    })
    .optional(),
  preferences: z
    .object({
      crisis_alerts_email: z.boolean().optional(),
      weekly_digest_email: z.boolean().optional(),
      ai_usage_alerts: z.boolean().optional(),
    })
    .optional(),
  owner_profile: z
    .object({
      name: z.string().trim().min(2).max(120).optional(),
      specialty: z.string().trim().max(80).optional().or(z.literal('')),
      crp: z.string().trim().max(40).optional().or(z.literal('')),
    })
    .optional(),
});

export type UpdateClinicSettingsPayload = z.infer<typeof UpdateClinicSettingsSchema>;
