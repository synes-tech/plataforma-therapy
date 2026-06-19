import { z } from 'https://deno.land/x/zod@v3.23.8/mod.ts';

export const ListPatientsSchema = z.object({
  q: z.string().max(200).optional(),
});
