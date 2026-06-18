export interface CheckRemindersPayload {
  stale_after_days?: number;
}

export interface CheckRemindersResponse {
  scanned: number;
  sent: number;
  failed: number;
  removed_expired: number;
}
