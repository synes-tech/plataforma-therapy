import { BackupAddonPanel } from './BackupAddonPanel';

interface BackupAddonCardProps {
  licenses: number;
  archivedCount: number;
  packSize: number;
  priceCentsPerPack: number;
  onLicensesUpdated?: (newTotal: number) => void;
}

export function BackupAddonCard({
  licenses,
  archivedCount,
  packSize,
  priceCentsPerPack,
  onLicensesUpdated,
}: BackupAddonCardProps) {
  return (
    <article className="dashboard-card-surface rounded-xl p-5 md:p-6">
      <BackupAddonPanel
        licenses={licenses}
        archivedCount={archivedCount}
        packSize={packSize}
        priceCentsPerPack={priceCentsPerPack}
        onLicensesUpdated={onLicensesUpdated}
      />
    </article>
  );
}
