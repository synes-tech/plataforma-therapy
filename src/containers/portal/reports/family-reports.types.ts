export type FamilyReportsTab = 'overview' | 'sessions' | 'documents' | 'clinical';

export const FAMILY_REPORTS_TABS: { id: FamilyReportsTab; label: string }[] = [
  { id: 'overview', label: 'Visão Geral' },
  { id: 'sessions', label: 'Histórico de Sessões' },
  { id: 'documents', label: 'Documentos Compartilhados' },
  { id: 'clinical', label: 'Ficha Clínica' },
];
