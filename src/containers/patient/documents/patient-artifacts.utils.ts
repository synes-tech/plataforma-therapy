import { resolveArtifactTitle } from './patient-artifacts.format';
import type { ArtifactFilterValue, PatientArtifact } from './patient-artifacts.types';

export function filterPatientArtifacts(
  items: PatientArtifact[],
  filter: ArtifactFilterValue,
  search = '',
): PatientArtifact[] {
  let result = filter === 'todos' ? items : items.filter((item) => item.tipo_artefato === filter);

  const query = search.trim().toLowerCase();
  if (!query) return result;

  return result.filter((item) => {
    const title = resolveArtifactTitle(item).toLowerCase();
    return title.includes(query) || item.conteudo_texto.toLowerCase().includes(query);
  });
}
