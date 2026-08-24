import { Navigate } from 'react-router-dom';
import { PageLoader } from '@containers/loading';
import { usePortalContext } from '@shared/lib/portal-context';
import { PORTAL_ROUTES } from '@shared/lib/portal-nav';
import { PatientChatContainer } from './PatientChatContainer';
import { TheryLockedScreen } from './TheryLockedScreen';

/**
 * Ivy — tela exclusiva de conversa do paciente.
 *
 * O cérebro fica no backend (`query-patient-companion`). Aqui só entra o chat
 * quando o servidor autorizou via `companion_chat`. Sem assinatura, a mesma
 * rota mostra o convite — o item do menu não some.
 */
export default function PortalCompanion() {
  const { data: portal, isLoading } = usePortalContext();

  if (isLoading) return <PageLoader minHeight="screen" label="Carregando..." />;
  if (!portal) return <Navigate to={PORTAL_ROUTES.diary} replace />;
  if (portal.access.level !== 'SELF') return <Navigate to={PORTAL_ROUTES.diary} replace />;

  if (!portal.capabilities.companion_chat) {
    return <TheryLockedScreen firstName={portal.patient.first_name} />;
  }

  return (
    <PatientChatContainer
      patientId={portal.patient.id}
      firstName={portal.patient.first_name}
    />
  );
}
