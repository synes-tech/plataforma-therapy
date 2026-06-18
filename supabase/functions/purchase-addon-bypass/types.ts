export interface PurchaseAddonBypassPayload {
  quantidade_comprada: number;
}

export interface PurchaseAddonBypassResponse {
  clinic_id: string;
  quantidade_comprada: number;
  quantidade_backup_pacientes: number;
  message: string;
}
