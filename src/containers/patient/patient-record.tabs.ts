import type { PatientRecordTab } from './patient-record.types';

export const TAB_PATH: Record<PatientRecordTab, string> = {
  copilot: 'copilot',
  overview: 'overview',
  checkins: 'checkins',
  clinical: 'clinical',
  documents: 'documents',
};

const PATH_TO_TAB: Record<string, PatientRecordTab> = {
  copilot: 'copilot',
  overview: 'overview',
  checkins: 'checkins',
  clinical: 'clinical',
  documents: 'documents',
  'saved-recommendations': 'documents',
  'crisis-control': 'checkins',
};

export function tabFromPath(segment?: string): PatientRecordTab {
  if (!segment) return 'copilot';
  return PATH_TO_TAB[segment] ?? 'copilot';
}

export function pathFromTab(tab: PatientRecordTab): string {
  return TAB_PATH[tab];
}
