export interface PlanControlStateResponse {
  clinic: {
    id: string;
    subscription_plan: string;
    subscription_status: string;
    is_solo_professional: boolean;
    trial_ends_at: string | null;
    payment_method_on_file: boolean;
  };
  backup: {
    quantidade_backup_pacientes: number;
    archived_count: number;
    pack_size: number;
    price_cents_per_pack: number;
  };
}
