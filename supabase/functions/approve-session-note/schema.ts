import { z } from 'https://deno.land/x/zod@v3.23.8/mod.ts';

const ShareModeSchema = z
  .enum(['as_is', 'refined', 'polished'])
  .optional()
  .transform((value) => (value === 'polished' ? 'refined' : value));

export const ApproveSessionNoteSchema = z
  .object({
    session_note_id: z.string().uuid(),
    compartilhar_familia: z.boolean().optional().default(false),
    share_mode: ShareModeSchema,
    family_text: z.string().min(10).max(50000).optional(),
    schedule_id: z.string().uuid().optional(),
  })
  .superRefine((data, ctx) => {
    if (!data.compartilhar_familia) return;

    if (!data.share_mode) {
      ctx.addIssue({
        code: z.ZodIssueCode.custom,
        message: 'share_mode é obrigatório ao compartilhar com a família',
        path: ['share_mode'],
      });
      return;
    }

    if (data.share_mode === 'refined' && !data.family_text?.trim()) {
      ctx.addIssue({
        code: z.ZodIssueCode.custom,
        message: 'family_text é obrigatório ao refinar para a família',
        path: ['family_text'],
      });
    }
  });
