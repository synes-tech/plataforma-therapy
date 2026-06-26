import { z } from 'https://deno.land/x/zod@v3.23.8/mod.ts';

export const GetFamilySessionDetailSchema = z.object({
  session_note_id: z.string().uuid(),
  patient_id: z.string().uuid().optional(),
});

export type GetFamilySessionDetailInput = z.infer<typeof GetFamilySessionDetailSchema>;
