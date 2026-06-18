import { z } from 'https://deno.land/x/zod@v3.23.8/mod.ts';

export const listAllReportsSchema = z.object({
  page: z.number().int().min(1).default(1),
  per_page: z.number().int().min(1).max(50).default(20),
  status: z.enum(['draft', 'approved', 'archived', 'all']).default('all'),
  patient_id: z.string().uuid().optional(),
  search: z.string().max(100).optional(),
});

export type ListAllReportsInput = z.infer<typeof listAllReportsSchema>;
