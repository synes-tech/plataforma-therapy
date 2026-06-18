import { z } from 'https://deno.land/x/zod@v3.23.8/mod.ts';

const recommendationItemSchema = z.object({
  title: z.string(),
  description: z.string(),
  category: z.enum(['activity', 'observation', 'follow_up', 'alert']),
  priority: z.enum(['high', 'medium', 'low']),
});

export const contextFlagsSchema = z
  .object({
    use_profile: z.boolean(),
    use_family_diary: z.boolean(),
    use_last_session: z.boolean(),
    use_history: z.boolean(),
  })
  .refine(
    (flags) => Object.values(flags).some(Boolean),
    { message: 'Selecione ao menos uma fonte de contexto' },
  );

export const recommendationsSchema = z.object({
  patient_id: z.string().uuid('patient_id deve ser um UUID válido'),
  context: contextFlagsSchema,
  regenerate: z.boolean().optional().default(false),
  previous_summary: z.string().max(5000).optional(),
  previous_recommendations: z.array(recommendationItemSchema).max(10).optional(),
});
