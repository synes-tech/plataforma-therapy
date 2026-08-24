import { Link } from 'react-router-dom';
import { StandardModal } from '@shared/ui/StandardModal';
import type { CompletedSessionItem } from './dashboard.types';
import { completedStatusLabel, formatCompletedWhen } from './home-layout.utils';

interface HomeSessionsModalProps {
  isOpen: boolean;
  onClose: () => void;
  title: string;
  items: CompletedSessionItem[];
  totalCount: number;
}

export function HomeSessionsModal({ isOpen, onClose, title, items, totalCount }: HomeSessionsModalProps) {
  return (
    <StandardModal isOpen={isOpen} onClose={onClose} title={title} size="lg">
      {items.length === 0 ? (
        <div className="rounded-2xl border border-dashed border-slate-200 bg-slate-50 px-5 py-8 text-center">
          <p className="text-sm font-medium text-charcoal">Nenhuma sessão realizada neste recorte.</p>
        </div>
      ) : (
        <ul className="divide-y divide-slate-100">
          {items.map((item) => (
            <li key={`${item.source}-${item.id}`} className="flex items-center justify-between gap-3 py-3">
              <div className="min-w-0">
                <p className="truncate text-sm font-medium text-charcoal">{item.patient_name}</p>
                <p className="mt-0.5 text-xs text-charcoal-muted">
                  {formatCompletedWhen(item.occurred_at)}
                  {item.title ? ` · ${item.title}` : ''}
                  {` · ${completedStatusLabel(item.status)}`}
                </p>
              </div>
              {item.patient_id ? (
                <Link
                  to={`/patients/${item.patient_id}`}
                  className="inline-flex min-h-11 shrink-0 items-center rounded-xl border border-slate-200 px-3 text-xs font-medium text-charcoal hover:border-primary/30 hover:text-primary"
                >
                  Prontuário
                </Link>
              ) : null}
            </li>
          ))}
        </ul>
      )}
      {totalCount > items.length ? (
        <p className="mt-4 text-xs text-charcoal-muted">
          Mostrando as {items.length} mais recentes de {totalCount} sessões.
        </p>
      ) : null}
    </StandardModal>
  );
}
