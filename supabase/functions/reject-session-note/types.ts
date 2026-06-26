export interface RejectSessionNotePayload {
  session_note_id: string;
  patient_id: string;
}

export interface RejectSessionNoteResponse {
  id: string;
  message: string;
}
