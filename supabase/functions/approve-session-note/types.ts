export type SessionNoteShareMode = 'as_is' | 'refined';

export interface ApproveSessionNotePayload {
  session_note_id: string;
  compartilhar_familia: boolean;
  share_mode?: SessionNoteShareMode;
  family_text?: string;
  schedule_id?: string;
}

export interface ApproveSessionNoteResponse {
  id: string;
  status: 'approved';
  visivel_familia: boolean;
  share_mode?: SessionNoteShareMode | null;
  clinical_raw_preserved: boolean;
  approved_at: string;
  schedule_completed: boolean;
  message: string;
}
