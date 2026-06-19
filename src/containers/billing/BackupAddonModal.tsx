import { StandardModal } from '@shared/ui/StandardModal';
import { BackupAddonPanel } from './BackupAddonPanel';

interface BackupAddonModalProps {
  isOpen: boolean;
  onClose: () => void;
  licenses: number;
  archivedCount: number;
  packSize: number;
  priceCentsPerPack: number;
}

export function BackupAddonModal({
  isOpen,
  onClose,
  licenses,
  archivedCount,
  packSize,
  priceCentsPerPack,
}: BackupAddonModalProps) {
  return (
    <StandardModal
      isOpen={isOpen}
      onClose={onClose}
      title="Arquivo Clínico Seguro"
      size="lg"
      footer={
        <button
          type="button"
          onClick={onClose}
          className="inline-flex h-11 w-full items-center justify-center rounded-xl border border-slate-200 bg-white px-5 text-sm font-medium text-charcoal transition-colors hover:bg-slate-50 md:w-auto"
        >
          Fechar
        </button>
      }
    >
      <BackupAddonPanel
        licenses={licenses}
        archivedCount={archivedCount}
        packSize={packSize}
        priceCentsPerPack={priceCentsPerPack}
        onPurchaseSuccess={onClose}
        submitLabel="Contratar espaço adicional"
      />
    </StandardModal>
  );
}
