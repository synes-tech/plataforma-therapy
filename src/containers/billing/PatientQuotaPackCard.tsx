import { PatientQuotaPackPanel, type PatientQuotaPackPanelProps } from './PatientQuotaPackPanel';

export function PatientQuotaPackCard(props: PatientQuotaPackPanelProps) {
  return (
    <article className="dashboard-card-surface rounded-xl p-5 md:p-6">
      <PatientQuotaPackPanel {...props} />
    </article>
  );
}
