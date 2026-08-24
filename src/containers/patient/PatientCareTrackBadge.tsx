import type { PatientListItem } from './patient-list.types';
import {
  CARE_TRACK_HINT,
  CARE_TRACK_LABEL,
  careTrackClass,
  resolvePatientCareTrack,
} from './patient-list.utils';

interface PatientCareTrackBadgeProps {
  patient: PatientListItem;
  className?: string;
}

export function PatientCareTrackBadge({ patient, className = '' }: PatientCareTrackBadgeProps) {
  const track = resolvePatientCareTrack(patient);

  return (
    <span
      title={CARE_TRACK_HINT[track]}
      aria-label={`${CARE_TRACK_LABEL[track]}. ${CARE_TRACK_HINT[track]}`}
      className={`inline-flex shrink-0 items-center rounded-full px-2.5 py-1 text-xs font-medium ${careTrackClass(track)} ${className}`.trim()}
    >
      {CARE_TRACK_LABEL[track]}
    </span>
  );
}
