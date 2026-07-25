import { z } from 'npm:zod@3.23.8';

export const sendSessionReminderSchema = z.object({
  session_id: z.string().uuid(),
});

export type SendSessionReminderPayload = z.infer<typeof sendSessionReminderSchema>;
