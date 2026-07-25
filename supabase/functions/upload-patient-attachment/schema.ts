import { z } from 'https://deno.land/x/zod@v3.23.8/mod.ts';

export const ALLOWED_ATTACHMENT_MIME = [
  'application/pdf',
  'application/vnd.openxmlformats-officedocument.wordprocessingml.document',
  'application/msword',
  'text/plain',
] as const;

export const MAX_ATTACHMENT_BYTES = 15 * 1024 * 1024;

const initiateSchema = z.object({
  action: z.literal('initiate'),
  patient_id: z.string().uuid(),
  file_name: z.string().trim().min(1).max(200),
  mime_type: z.enum(ALLOWED_ATTACHMENT_MIME),
  file_size_bytes: z.number().int().positive().max(MAX_ATTACHMENT_BYTES),
  description: z.string().trim().max(300).optional(),
});

const confirmSchema = z.object({
  action: z.literal('confirm'),
  patient_id: z.string().uuid(),
  attachment_id: z.string().uuid(),
  storage_path: z.string().min(1).max(500),
  file_name: z.string().trim().min(1).max(200),
  mime_type: z.enum(ALLOWED_ATTACHMENT_MIME),
  file_size_bytes: z.number().int().positive().max(MAX_ATTACHMENT_BYTES),
  description: z.string().trim().max(300).optional(),
});

export const UploadPatientAttachmentSchema = z.discriminatedUnion('action', [
  initiateSchema,
  confirmSchema,
]);
