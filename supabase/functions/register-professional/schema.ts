import { z } from 'https://deno.land/x/zod@v3.23.8/mod.ts';

export const RegisterProfessionalSchema = z.object({
  name: z.string().min(2).max(100),
  email: z.string().email(),
  password: z.string().min(6).max(128),
  specialty: z.string().max(100).optional(),
  crp: z.string().max(30).optional(),
});
