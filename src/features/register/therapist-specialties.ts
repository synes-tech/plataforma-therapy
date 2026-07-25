export interface TherapistSpecialtyOption {
  id: string;
  label: string;
}

/** Especialidades comuns em atendimento infantil / neurodesenvolvimento no Brasil */
export const THERAPIST_SPECIALTY_OPTIONS: TherapistSpecialtyOption[] = [
  { id: 'psicologia-clinica', label: 'Psicologia clínica' },
  { id: 'psicologia-infantil', label: 'Psicologia infantil' },
  { id: 'fonoaudiologia', label: 'Fonoaudiologia' },
  { id: 'terapia-ocupacional', label: 'Terapia ocupacional' },
  { id: 'neuropsicologia', label: 'Neuropsicologia' },
  { id: 'psicopedagogia', label: 'Psicopedagogia' },
  { id: 'musicoterapia', label: 'Musicoterapia' },
  { id: 'fisioterapia-neurofuncional', label: 'Fisioterapia neurofuncional infantil' },
  { id: 'nutricao', label: 'Nutrição' },
  { id: 'outros', label: 'Outros' },
];

export function resolveTherapistSpecialty(
  specialtyId: string,
  specialtyOther: string,
): string | undefined {
  if (!specialtyId) return undefined;
  if (specialtyId === 'outros') {
    const custom = specialtyOther.trim();
    return custom || undefined;
  }
  return THERAPIST_SPECIALTY_OPTIONS.find((option) => option.id === specialtyId)?.label;
}
