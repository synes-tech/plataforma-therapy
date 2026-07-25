export interface StripeTestCreateCheckoutPayload {
  mode: 'test' | 'live';
  plan_id: 'inicial' | 'intermediario' | 'teste_1_real';
  lookup_key?: string;
}
