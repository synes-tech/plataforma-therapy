import { useCallback, useEffect, useMemo, useState } from 'react';
import { useLocation, useNavigate } from 'react-router-dom';
import { useQuery } from '@tanstack/react-query';
import { useAuth } from '@shared/hooks/useAuth';
import { callFunction } from '@shared/lib/api';
import { getFirebaseCurrentUser } from '@shared/lib/firebase';
import { usePortalContext } from '@shared/lib/portal-context';
import { canAccessFinance, isClinicOwner } from '@shared/lib/roles';
import type { PatientListItem } from '@containers/patient/patient-list.types';
import { TheryWelcomeModal } from './TheryWelcomeModal';
import { TheryTourLayer } from './TheryTourLayer';
import { TheryTourContext } from './thery-tour-context';
import { scriptForAudience } from './thery-tour.scripts';
import { readTourRecord, writeTourRecord } from './thery-tour.storage';
import type { TheryTourApi, TheryTourAudience, TheryTourRuntimeContext } from './thery-tour.types';
import {
  readTourViewport,
  resolveTourAudience,
  resolveTourRoute,
  selectTourSteps,
  welcomeFirstName,
} from './thery-tour.utils';

function persist(userId: string, audience: TheryTourAudience, status: 'skipped' | 'in_progress' | 'completed', stepIndex: number) {
  writeTourRecord(userId, audience, {
    status,
    stepIndex,
    updatedAt: new Date().toISOString(),
  });
}

export function TheryTourProvider({ children }: { children: React.ReactNode }) {
  const { user } = useAuth();
  const navigate = useNavigate();
  const location = useLocation();
  const { data: portal } = usePortalContext();
  const [welcomeOpen, setWelcomeOpen] = useState(false);
  const [active, setActive] = useState(false);
  const [stepIndex, setStepIndex] = useState(0);
  const [viewport, setViewport] = useState<'desktop' | 'mobile'>(() => readTourViewport());
  const [hydrated, setHydrated] = useState(false);

  const audience = resolveTourAudience(user, portal);

  const needsPatients = Boolean(
    user && (user.role === 'professional' || user.role === 'clinic_admin' || user.role === 'master'),
  );
  const patientsQuery = useQuery({
    queryKey: ['patients', ''],
    queryFn: () => callFunction<PatientListItem[]>('list-patients', {}),
    enabled: needsPatients,
    staleTime: 60_000,
  });

  const patientId = patientsQuery.data?.[0]?.id ?? null;
  const canFinance = canAccessFinance(user);
  const isOwner = isClinicOwner(user);

  const runtime = useMemo<TheryTourRuntimeContext | null>(
    () =>
      audience
        ? { audience, viewport, canFinance, isOwner, patientId }
        : null,
    [audience, canFinance, isOwner, patientId, viewport],
  );

  const steps = useMemo(
    () => (runtime ? selectTourSteps(scriptForAudience(runtime.audience), runtime) : []),
    [runtime],
  );
  const patientsReady = !needsPatients || patientsQuery.isFetched;

  const step = active ? steps[stepIndex] ?? null : null;

  const firstName = welcomeFirstName(
    portal?.patient.first_name || getFirebaseCurrentUser()?.displayName || user?.email?.split('@')[0] || '',
  );

  useEffect(() => {
    function onResize() {
      setViewport(readTourViewport());
    }
    window.addEventListener('resize', onResize);
    return () => window.removeEventListener('resize', onResize);
  }, []);

  useEffect(() => {
    setHydrated(false);
    setWelcomeOpen(false);
    setActive(false);
    setStepIndex(0);
  }, [user?.id, audience]);

  useEffect(() => {
    if (!user || !audience || hydrated || !patientsReady) return;
    const record = readTourRecord(user.id, audience);
    if (!record) {
      setWelcomeOpen(true);
      setHydrated(true);
      return;
    }
    if (record.status === 'in_progress') {
      setActive(true);
      setStepIndex(Math.min(record.stepIndex, Math.max(steps.length - 1, 0)));
    }
    setHydrated(true);
  }, [user, audience, hydrated, patientsReady, steps.length]);

  const goTo = useCallback(
    (index: number) => {
      if (!user || !audience) return;
      if (index >= steps.length) {
        setActive(false);
        persist(user.id, audience, 'completed', 0);
        return;
      }
      if (index < 0) return;
      setStepIndex(index);
      persist(user.id, audience, 'in_progress', index);
      const nextStep = steps[index];
      if (nextStep) {
        const dest = resolveTourRoute(nextStep.route, patientId);
        if (location.pathname !== dest) navigate(dest);
      }
    },
    [audience, location.pathname, navigate, patientId, steps, user],
  );

  const start = useCallback(() => {
    if (!user || !audience) return;
    setWelcomeOpen(false);
    setActive(true);
    setStepIndex(0);
    persist(user.id, audience, 'in_progress', 0);
    const first = steps[0];
    if (first) navigate(resolveTourRoute(first.route, patientId));
  }, [audience, navigate, patientId, steps, user]);

  const skipAll = useCallback(() => {
    if (!user || !audience) return;
    setWelcomeOpen(false);
    setActive(false);
    persist(user.id, audience, 'skipped', 0);
  }, [audience, user]);

  const next = useCallback(() => goTo(stepIndex + 1), [goTo, stepIndex]);
  const back = useCallback(() => goTo(stepIndex - 1), [goTo, stepIndex]);

  const replay = useCallback(() => {
    if (!user || !audience) return;
    setWelcomeOpen(false);
    setActive(true);
    setStepIndex(0);
    persist(user.id, audience, 'in_progress', 0);
    const first = steps[0];
    navigate(first ? resolveTourRoute(first.route, patientId) : '/dashboard');
  }, [audience, navigate, patientId, steps, user]);

  const skipMissing = useCallback(
    (stepId: string) => {
      if (!step || step.id !== stepId) return;
      goTo(stepIndex + 1);
    },
    [goTo, step, stepIndex],
  );

  const api = useMemo<TheryTourApi>(
    () => ({
      audience,
      active,
      welcomeOpen,
      step,
      stepIndex,
      stepCount: steps.length,
      firstName,
      patientId,
      start,
      skipAll,
      next,
      back,
      replay,
      skipMissing,
    }),
    [
      active,
      audience,
      back,
      firstName,
      next,
      patientId,
      replay,
      skipAll,
      skipMissing,
      start,
      step,
      stepIndex,
      steps.length,
      welcomeOpen,
    ],
  );

  return (
    <TheryTourContext.Provider value={api}>
      {children}
      {audience && welcomeOpen ? (
        <TheryWelcomeModal
          isOpen={welcomeOpen}
          audience={audience}
          firstName={firstName}
          onStart={start}
          onSkip={skipAll}
        />
      ) : null}
      {step && active && steps.length > 0 ? (
        <TheryTourLayer
          step={step}
          stepIndex={stepIndex}
          stepCount={steps.length}
          expectedRoute={resolveTourRoute(step.route, patientId)}
          onNext={next}
          onBack={back}
          onSkip={skipAll}
          onMissing={skipMissing}
        />
      ) : null}
    </TheryTourContext.Provider>
  );
}
