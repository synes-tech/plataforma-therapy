import type {
  PatientDiagnosisFilter,
  PatientListFilters,
  PatientListItem,
  PatientSortOption,
  PatientStatusFilter,
  FamilyLinkStatus,
} from './patient-list.types';

export function getPatientAge(birthDate: string): number {
  return Math.floor(
    (Date.now() - new Date(birthDate).getTime()) / (365.25 * 24 * 60 * 60 * 1000),
  );
}

function matchesDiagnosisFilter(diagnoses: string[], filter: PatientDiagnosisFilter): boolean {
  if (filter === 'all') return true;

  const labels = diagnoses.map((d) => d.toLowerCase());
  const hasTea = labels.some((d) => d.includes('tea') || d.includes('autis'));
  const hasTdah = labels.some((d) => d.includes('tdah') || d.includes('atenção') || d.includes('atencao'));
  const hasAnxiety = labels.some((d) => d.includes('ansied') || d.includes('toc'));
  const hasOther = labels.some(
    (d) =>
      !d.includes('tea') &&
      !d.includes('autis') &&
      !d.includes('tdah') &&
      !d.includes('atenção') &&
      !d.includes('atencao') &&
      !d.includes('ansied') &&
      !d.includes('toc'),
  );

  if (filter === 'tea') return hasTea;
  if (filter === 'tdah') return hasTdah;
  if (filter === 'anxiety') return hasAnxiety;
  if (filter === 'other') return hasOther;
  return true;
}

function matchesStatusFilter(status: string, filter: PatientStatusFilter): boolean {
  if (filter === 'all') return true;
  return status === filter;
}

function sortPatients(items: PatientListItem[], sort: PatientSortOption): PatientListItem[] {
  const sorted = [...items];

  sorted.sort((a, b) => {
    switch (sort) {
      case 'name_desc':
        return b.name.localeCompare(a.name, 'pt-BR');
      case 'recent':
        return new Date(b.created_at).getTime() - new Date(a.created_at).getTime();
      case 'age_asc':
        return getPatientAge(a.birth_date) - getPatientAge(b.birth_date);
      case 'age_desc':
        return getPatientAge(b.birth_date) - getPatientAge(a.birth_date);
      case 'name_asc':
      default:
        return a.name.localeCompare(b.name, 'pt-BR');
    }
  });

  return sorted;
}

export function applyPatientListFilters(
  patients: PatientListItem[],
  filters: PatientListFilters,
): PatientListItem[] {
  const filtered = patients.filter(
    (p) =>
      matchesStatusFilter(p.status, filters.status) &&
      matchesDiagnosisFilter(p.diagnoses, filters.diagnosis),
  );

  return sortPatients(filtered, filters.sort);
}

export function paginatePatients<T>(items: T[], page: number, pageSize: number): T[] {
  const start = (page - 1) * pageSize;
  return items.slice(start, start + pageSize);
}

export function getPaginationMeta(total: number, page: number, pageSize: number) {
  const totalPages = Math.max(1, Math.ceil(total / pageSize));
  const safePage = Math.min(Math.max(1, page), totalPages);
  const start = total === 0 ? 0 : (safePage - 1) * pageSize + 1;
  const end = Math.min(safePage * pageSize, total);

  return { totalPages, safePage, start, end };
}

export const STATUS_LABEL: Record<string, string> = {
  active: 'Ativo',
  inactive: 'Inativo',
  suspended: 'Suspenso',
};

export function statusClass(status: string): string {
  if (status === 'active') return 'bg-mint-50 text-mint-dark';
  if (status === 'suspended') return 'bg-error-light text-error';
  return 'bg-slate-100 text-charcoal-muted';
}

export function statusDotClass(status: string): string {
  if (status === 'active') return 'bg-mint';
  if (status === 'suspended') return 'bg-error';
  return 'bg-slate-400';
}

export const FAMILY_LINK_LABEL: Record<FamilyLinkStatus, string> = {
  vinculado: 'Vinculado',
  pendente: 'Pendente',
};

export function familyLinkStatusClass(status: FamilyLinkStatus): string {
  if (status === 'vinculado') return 'bg-mint-50 text-mint-dark ring-1 ring-mint/20';
  return 'bg-amber-50 text-amber-800 ring-1 ring-amber-200/80';
}

export function familyLinkDotClass(status: FamilyLinkStatus): string {
  return status === 'vinculado' ? 'bg-mint' : 'bg-alert';
}

export function resolveFamilyLinkStatus(patient: PatientListItem): FamilyLinkStatus {
  return patient.family_link_status ?? 'pendente';
}
