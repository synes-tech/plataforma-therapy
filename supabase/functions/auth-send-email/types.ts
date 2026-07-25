export interface AuthSendEmailUser {
  email: string;
  new_email?: string;
  user_metadata?: Record<string, unknown>;
}

export interface AuthSendEmailData {
  token: string;
  token_hash: string;
  token_new?: string;
  token_hash_new?: string;
  redirect_to: string;
  email_action_type: string;
  site_url: string;
  old_email?: string;
}

export interface AuthSendEmailHookPayload {
  user: AuthSendEmailUser;
  email_data: AuthSendEmailData;
}
