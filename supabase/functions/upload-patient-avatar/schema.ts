import { z } from 'https://deno.land/x/zod@v3.23.8/mod.ts';

const ALLOWED_MIME = ['image/jpeg', 'image/png', 'image/webp'] as const;
const MAX_BYTES = 5 * 1024 * 1024;

export const UploadPatientAvatarSchema = z.object({
  patient_id: z.string().uuid(),
  action: z.enum(['initiate', 'confirm']).optional().default('initiate'),
  mime_type: z.enum(ALLOWED_MIME).optional(),
  file_size_bytes: z.number().int().min(1).max(MAX_BYTES).optional(),
  storage_path: z.string().min(3).max(500).optional(),
}).superRefine((data, ctx) => {
  if (data.action === 'confirm') {
    if (!data.storage_path) {
      ctx.addIssue({ code: z.ZodIssueCode.custom, message: 'storage_path obrigatório', path: ['storage_path'] });
    }
  } else {
    if (!data.mime_type) {
      ctx.addIssue({ code: z.ZodIssueCode.custom, message: 'mime_type obrigatório', path: ['mime_type'] });
    }
    if (!data.file_size_bytes) {
      ctx.addIssue({ code: z.ZodIssueCode.custom, message: 'file_size_bytes obrigatório', path: ['file_size_bytes'] });
    }
  }
});

export { ALLOWED_MIME, MAX_BYTES };
