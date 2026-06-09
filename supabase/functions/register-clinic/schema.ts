import { z } from 'https://deno.land/x/zod@v3.23.8/mod.ts';

export const RegisterClinicSchema = z.object({
  clinic_name: z.string().min(2).max(200),
  clinic_document: z.string().optional(),
  clinic_email: z.string().email(),
  clinic_phone: z.string().optional(),
  admin_name: z.string().min(2).max(100),
  admin_email: z.string().email(),
  admin_password: z.string().min(6).max(128),
  plan: z.enum(['consultorio', 'starter', 'professional', 'enterprise']).default('starter'),
  specialty: z.string().max(100).optional(),
});
