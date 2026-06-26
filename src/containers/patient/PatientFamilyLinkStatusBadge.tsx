import type { PatientListItem } from './patient-list.types';
import {
  FAMILY_LINK_LABEL,
  familyLinkDotClass,
  familyLinkStatusClass,
  resolveFamilyLinkStatus,
} from './patient-list.utils';

interface PatientFamilyLinkStatusBadgeProps {
  patient: PatientListItem;
  className?: string;
}

function LinkIcon({ linked }: { linked: boolean }) {
  if (linked) {
    return (
      <svg className="h-3.5 w-3.5 shrink-0" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2} aria-hidden>
        <path strokeLinecap="round" strokeLinejoin="round" d="M13.828 10.172a4 4 0 00-5.656 0l-4 4a4 4 0 105.656 5.656l1.102-1.101m-.758-4.899a4 4 0 005.656 0l4-4a4 4 0 00-5.656-5.656l-1.1 1.1" />
      </svg>
    );
  }

  return (
    <svg className="h-3.5 w-3.5 shrink-0" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2} aria-hidden>
      <path strokeLinecap="round" strokeLinejoin="round" d="M12 8v4l3 3m6-3a9 9 0 11-18 0 9 9 0 0118 0z" />
    </svg>
  );
}

export function PatientFamilyLinkStatusBadge({ patient, className = '' }: PatientFamilyLinkStatusBadgeProps) {
  const status = resolveFamilyLinkStatus(patient);
  const label = FAMILY_LINK_LABEL[status];
  const linked = status === 'vinculado';

  return (
    <span
      className={`inline-flex shrink-0 items-center gap-1.5 rounded-full px-2.5 py-1 text-xs font-medium ${familyLinkStatusClass(status)} ${className}`.trim()}
      title={
        linked
          ? 'Família validou o código e está ativa no aplicativo'
          : 'Família ainda não validou o código de acesso no aplicativo'
      }
    >
      <span className={`h-2 w-2 shrink-0 rounded-full ${familyLinkDotClass(status)}`} aria-hidden />
      <LinkIcon linked={linked} />
      {label}
    </span>
  );
}
