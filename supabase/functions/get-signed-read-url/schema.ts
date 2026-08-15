import { z } from 'https://deno.land/x/zod@v3.23.8/mod.ts';

export const GetSignedReadUrlSchema = z.object({
  bucket: z.enum([
    'audio-recordings',
    'family-diary-audio',
    'pacientes-anexos',
    'pacientes-avatars',
    'profissionais-avatars',
  ]),
  path: z.string().min(3).max(1024),
  expires_in: z.number().int().min(60).max(3600).optional(),
});
