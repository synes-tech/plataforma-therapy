export type PatientListTab = 'active' | 'archive';

export type PatientStatusFilter = 'all' | 'active' | 'inactive' | 'suspended';

export type PatientDiagnosisFilter = 'all' | 'tea' | 'tdah' | 'anxiety' | 'other';

export type PatientSortOption = 'name_asc' | 'name_desc' | 'recent' | 'age_asc' | 'age_desc';

export interface PatientListItem {
  id: string;
  name: string;
  birth_date: string;
  diagnoses: string[];
  status: string;
  created_at: string;
  foto_url?: string | null;
}

export interface PatientListFilters {
  status: PatientStatusFilter;
  diagnosis: PatientDiagnosisFilter;
  sort: PatientSortOption;
}

export const PATIENT_PAGE_SIZE = 10;

export const DEFAULT_PATIENT_FILTERS: PatientListFilters = {
  status: 'all',
  diagnosis: 'all',
  sort: 'name_asc',
};
