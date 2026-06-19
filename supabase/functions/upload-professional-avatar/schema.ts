import { z } from 'https://deno.land/x/zod@v3.23.8/mod.ts';

export const ALLOWED_MIME = ['image/jpeg', 'image/png', 'image/webp'] as const;
export const MAX_BYTES = 5 * 1024 * 1024;

const InitiateSchema = z.object({
  action: z.literal('initiate'),
  mime_type: z.enum(ALLOWED_MIME),
  file_size_bytes: z.number().int().positive().max(MAX_BYTES),
});

const ConfirmSchema = z.object({
  action: z.literal('confirm'),
  storage_path: z.string().min(1).max(512),
});

export const UploadProfessionalAvatarSchema = z.discriminatedUnion('action', [
  InitiateSchema,
  ConfirmSchema,
]);
