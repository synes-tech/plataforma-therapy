import { useQuery } from '@tanstack/react-query';
import { supabase } from '@shared/lib/supabase';
import type { ClinicalModule } from '@shared/lib/clinical-profile';

export interface ClinicalTaxonomyEntry {
  id: string;
  code: string;
  label: string;
  short_label: string | null;
  category: string;
  synonyms: string[] | null;
  suggested_modules: ClinicalModule[] | null;
  sort_order: number;
}

export const CATEGORY_LABELS: Record<string, string> = {
  NEURODESENVOLVIMENTO: 'Neurodesenvolvimento',
  ANSIEDADE: 'Ansiedade',
  HUMOR: 'Humor',
  TRAUMA: 'Trauma e estresse',
  TOC_RELACIONADOS: 'TOC e relacionados',
  ALIMENTARES: 'Alimentares',
  PERSONALIDADE: 'Personalidade',
  DEPENDENCIA: 'Dependência',
  PSICOSE: 'Psicose',
  SONO: 'Sono',
  SOMATICO: 'Somático',
  VIDA: 'Questões de vida',
};

export function categoryLabel(category: string): string {
  return CATEGORY_LABELS[category] ?? category;
}

/**
 * O catálogo é pequeno (64 verbetes), curado e praticamente estático — carregar tudo de uma
 * vez e filtrar no cliente dá busca instantânea, sem uma requisição por tecla.
 */
export function useClinicalTaxonomy() {
  return useQuery({
    queryKey: ['clinical-taxonomy'],
    staleTime: 24 * 60 * 60 * 1000,
    gcTime: 24 * 60 * 60 * 1000,
    queryFn: async (): Promise<ClinicalTaxonomyEntry[]> => {
      const { data, error } = await supabase
        .from('clinical_taxonomy')
        .select('id, code, label, short_label, category, synonyms, suggested_modules, sort_order')
        .eq('active', true)
        .order('sort_order');

      if (error) throw new Error(error.message);
      return (data ?? []) as ClinicalTaxonomyEntry[];
    },
  });
}

/** Remove acento e caixa para que "ansiedade" ache "Ansiedade" e "tdah" ache "TDAH". */
export function normalizeSearch(value: string): string {
  return value
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '')
    .toLowerCase()
    .trim();
}

export function displayLabel(entry: ClinicalTaxonomyEntry): string {
  return entry.short_label?.trim() || entry.label;
}

/**
 * Busca por rótulo, nome clínico completo, código e sinônimos.
 *
 * Os sinônimos existem justamente para que o terapeuta encontre pelo termo que ele usa no
 * dia a dia — quem digita "autismo" precisa achar TEA, e quem digita "burnout" precisa
 * achar esgotamento profissional.
 */
export function filterTaxonomy(
  entries: ClinicalTaxonomyEntry[],
  query: string,
  excludeIds: readonly string[] = [],
): ClinicalTaxonomyEntry[] {
  const excluded = new Set(excludeIds);
  const available = entries.filter((entry) => !excluded.has(entry.id));

  const term = normalizeSearch(query);
  if (!term) return available;

  return available.filter((entry) => {
    const haystack = [
      entry.label,
      entry.short_label ?? '',
      entry.code,
      ...(entry.synonyms ?? []),
    ]
      .map(normalizeSearch)
      .join(' | ');
    return haystack.includes(term);
  });
}

export function groupByCategory(
  entries: ClinicalTaxonomyEntry[],
): { category: string; label: string; items: ClinicalTaxonomyEntry[] }[] {
  const groups = new Map<string, ClinicalTaxonomyEntry[]>();
  for (const entry of entries) {
    const list = groups.get(entry.category) ?? [];
    list.push(entry);
    groups.set(entry.category, list);
  }
  return [...groups.entries()].map(([category, items]) => ({
    category,
    label: categoryLabel(category),
    items,
  }));
}
