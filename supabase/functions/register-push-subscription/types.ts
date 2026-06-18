export interface RegisterPushPayload {
  endpoint: string;
  keys: {
    p256dh: string;
    auth: string;
  };
  user_agent?: string;
}

export interface RegisterPushResponse {
  subscription_id: string;
  message: string;
}
