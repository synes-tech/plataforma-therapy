import { useCallback, useEffect, useMemo, useState } from 'react';
import { useQuery, useQueryClient } from '@tanstack/react-query';
import { callFunction } from '@shared/lib/api';
import { artifactFingerprint, artifactSaveKey } from './patient-copilot-fingerprint';
import type { AiArtifactType } from './patient-copilot.types';

interface SavedArtifactKey {
  artifact_fingerprint: string;
  tipo_artefato: string;
}

interface ArtifactStatusResponse {
  saved: SavedArtifactKey[];
}

function loadLocalSaved(patientId: string): Set<string> {
  try {
    const raw = localStorage.getItem(`copilot-saved-artifacts:${patientId}`);
    if (!raw) return new Set();
    const parsed = JSON.parse(raw) as string[];
    return new Set(parsed);
  } catch {
    return new Set();
  }
}

function persistLocalSaved(patientId: string, keys: Set<string>) {
  localStorage.setItem(`copilot-saved-artifacts:${patientId}`, JSON.stringify([...keys]));
}

export function serializeSavedKeys(keys: Set<string>): string {
  return [...keys].sort().join('|');
}

export function usePatientCopilotSavedArtifacts(patientId: string) {
  const queryClient = useQueryClient();
  const [localKeys, setLocalKeys] = useState<Set<string>>(() => loadLocalSaved(patientId));

  const { data } = useQuery({
    queryKey: ['ai-artifact-status', patientId],
    queryFn: () =>
      callFunction<ArtifactStatusResponse>('list-ai-artifact-status', { patient_id: patientId }),
    enabled: !!patientId,
    staleTime: 30_000,
  });

  useEffect(() => {
    setLocalKeys(loadLocalSaved(patientId));
  }, [patientId]);

  const savedKeys = useMemo(() => {
    const keys = new Set(localKeys);
    for (const item of data?.saved ?? []) {
      keys.add(artifactSaveKey(item.artifact_fingerprint, item.tipo_artefato));
    }
    return keys;
  }, [localKeys, data?.saved]);

  const savedKeysSerialized = useMemo(() => serializeSavedKeys(savedKeys), [savedKeys]);

  const saveArtifact = useCallback(
    async (content: string, tipo: AiArtifactType) => {
      const fingerprint = await artifactFingerprint(content);
      const key = artifactSaveKey(fingerprint, tipo);

      await callFunction('save-ai-artifact', {
        patient_id: patientId,
        conteudo_texto: content,
        tipo_artefato: tipo,
      });

      setLocalKeys((prev) => {
        const next = new Set(prev);
        next.add(key);
        persistLocalSaved(patientId, next);
        return next;
      });

      void queryClient.invalidateQueries({ queryKey: ['ai-artifact-status', patientId] });
      void queryClient.invalidateQueries({ queryKey: ['patient-artifacts', patientId] });

      return { key, tipo, fingerprint };
    },
    [patientId, queryClient],
  );

  return {
    savedKeys,
    savedKeysSerialized,
    saveArtifact,
  };
}
