import type {
  ClinicalModule,
  PatientProfileType,
  PortalAccessLevel,
} from '../_shared/patient-profile.ts';

interface CreatePatientCommonFields {
  name: string;
  birth_date: string;
  gender?: string;
  diagnoses?: string[];
  clinical_observations?: string | null;
  profile_type?: PatientProfileType;
  active_modules?: ClinicalModule[];
  condition_ids?: string[];
  support_network?: string | null;
  occupation_routine?: string | null;
  mapped_triggers?: string | null;
  contact_scope?: 'patient' | 'responsible' | 'both';
  email_paciente?: string | null;
  telefone_paciente?: string | null;
  email_responsavel?: string | null;
  telefone_responsavel?: string | null;
  // Anamnese: espelha AnamnesisFieldsSchema, que exige acompanhamento_multi presente.
  acompanhamento_multi: string[];
  nome_social?: string | null;
  escolaridade_ocupacao?: string | null;
  queixa_principal?: string | null;
  medicamentos?: string | null;
  composicao_familiar?: string | null;
  responsaveis?: string | null;
  objetivos_terapeuticos?: string | null;
  hiperfocos_interesses?: string | null;
  informacoes_adicionais?: string | null;
  portal_invite?: {
    send?: boolean;
    email?: string | null;
    name?: string | null;
    relationship?: string | null;
    expires_in_hours?: number;
  };
  [key: string]: unknown;
}

export type CreatePatientPayload =
  | (CreatePatientCommonFields & {
      possui_cpf_proprio: true;
      cpf_paciente: string;
    })
  | (CreatePatientCommonFields & {
      possui_cpf_proprio: false;
      cpf_responsavel: string;
      nome_responsavel: string;
    });

export interface CreatePatientResponse {
  patient_id: string;
  message: string;
  contract?: Record<string, unknown>;
  needs_windows?: boolean;
  next_step?: string | null;
  profile_type: PatientProfileType;
  active_modules: ClinicalModule[];
  portal_invite: {
    code: string;
    access_level: PortalAccessLevel;
    recipient: 'patient' | 'caregiver';
    email: string | null;
    sent: boolean;
  } | null;
}
