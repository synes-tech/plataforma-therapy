import { z } from 'https://deno.land/x/zod@v3.23.8/mod.ts';

const mimeTypes = ['audio/webm', 'audio/mp4', 'audio/mpeg', 'audio/wav', 'audio/ogg'] as const;

export const InitiateFamilyAudioSchema = z.object({
  step: z.literal('initiate'),
  patient_id: z.string().uuid(),
  mime_type: z.enum(mimeTypes),
  duration_seconds: z.number().int().min(1).max(300).optional(),
});

export const CompleteFamilyAudioSchema = z.object({
  step: z.literal('complete'),
  patient_id: z.string().uuid(),
  storage_path: z.string().min(10).max(500),
  mime_type: z.enum(mimeTypes),
  duration_seconds: z.number().int().min(1).max(300).optional(),
});

export const ProcessFamilyAudioSchema = z.discriminatedUnion('step', [
  InitiateFamilyAudioSchema,
  CompleteFamilyAudioSchema,
]);
