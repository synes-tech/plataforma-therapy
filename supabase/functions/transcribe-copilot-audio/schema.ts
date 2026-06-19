import { z } from 'https://deno.land/x/zod@v3.23.8/mod.ts';

const mimeTypes = ['audio/webm', 'audio/mp4', 'audio/mpeg', 'audio/wav', 'audio/ogg'] as const;

export const InitiateCopilotAudioSchema = z.object({
  step: z.literal('initiate'),
  patient_id: z.string().uuid(),
  mime_type: z.enum(mimeTypes),
  duration_seconds: z.number().int().min(1).max(180).optional(),
});

export const CompleteCopilotAudioSchema = z.object({
  step: z.literal('complete'),
  patient_id: z.string().uuid(),
  storage_path: z.string().min(10).max(500),
  mime_type: z.enum(mimeTypes),
  duration_seconds: z.number().int().min(1).max(180).optional(),
});

export const TranscribeCopilotAudioSchema = z.discriminatedUnion('step', [
  InitiateCopilotAudioSchema,
  CompleteCopilotAudioSchema,
]);
