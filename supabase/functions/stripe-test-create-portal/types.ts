export interface StripeTestCreatePortalPayload {
  session_id: string;
  mode: 'test' | 'live';
}
