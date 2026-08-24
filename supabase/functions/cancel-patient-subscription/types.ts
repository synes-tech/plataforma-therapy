export interface CancelPatientSubscriptionResponse {
  action: 'preview' | 'confirm';
  canceled?: boolean;
  in_trial: boolean;
  cancels_immediately: boolean;
  effective_at: string;
  status: string;
  message: string;
}
