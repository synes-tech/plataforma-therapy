export type ClassifyTabTone = 'green' | 'blue' | 'amber';

export function classifyTabTone(count: number): ClassifyTabTone {
  if (count <= 0) return 'green';
  if (count <= 10) return 'blue';
  return 'amber';
}

export function classifyTabClassName(count: number, active: boolean): string {
  const tone = classifyTabTone(count);
  const ring = active ? 'ring-2 ring-offset-1 ring-charcoal/15' : '';
  if (tone === 'green') return `bg-emerald-50 text-emerald-800 ${ring}`;
  if (tone === 'blue') return `bg-primary-50 text-primary ${ring}`;
  return `bg-amber-100 text-red-700 ${ring}`;
}

export function competenceFromDate(isoDate: string): string {
  const month = isoDate.slice(0, 7);
  return /^\d{4}-\d{2}$/.test(month) ? `${month}-01` : `${new Date().toISOString().slice(0, 7)}-01`;
}
