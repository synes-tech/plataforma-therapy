import { z } from 'https://deno.land/x/zod@v3.23.8/mod.ts';

const recommendationItemSchema = z.object({
  title: z.string().min(1).max(300),
  description: z.string().min(1).max(5000),
  category: z.enum(['activity', 'observation', 'follow_up', 'alert']),
  priority: z.enum(['high', 'medium', 'low']),
});

export const SaveRecommendationSchema = z.object({
  patient_id: z.string().uuid(),
  conteudo: z.object({
    summary: z.string().max(5000),
    recommendations: z.array(recommendationItemSchema).min(1).max(10),
    generated_at: z.string().optional(),
  }),
});
