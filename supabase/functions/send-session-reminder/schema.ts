import { z } from 'npm:zod@3.23.8';

export const sendSessionReminderSchema = z
  .object({
    session_id: z.string().uuid(),
    mode: z.enum(['now', 'at']).default('now'),
    send_at: z.string().datetime({ message: 'send_at deve ser ISO 8601' }).optional(),
  })
  .superRefine((data, ctx) => {
    if (data.mode === 'at' && !data.send_at) {
      ctx.addIssue({
        code: z.ZodIssueCode.custom,
        message: 'send_at é obrigatório quando mode=at',
        path: ['send_at'],
      });
    }
  });

export type SendSessionReminderPayload = z.infer<typeof sendSessionReminderSchema>;
