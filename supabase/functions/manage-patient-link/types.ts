export type ManagePatientLinkAction = 'unlink' | 'delete';

export interface ManagePatientLinkPayload {
  patient_id: string;
  acao: ManagePatientLinkAction;
  confirm_name?: string;
}

export interface ManagePatientLinkResponse {
  patient_id: string;
  acao: ManagePatientLinkAction;
  message: string;
}
