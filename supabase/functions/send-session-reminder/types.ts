export type { SendSessionReminderPayload } from './schema.ts';

export interface SendSessionReminderResponse {
  mode: 'now' | 'at';
  sent_to: string;
  contact_name: string;
  session_at: string;
  send_at?: string;
  queued?: number;
}
