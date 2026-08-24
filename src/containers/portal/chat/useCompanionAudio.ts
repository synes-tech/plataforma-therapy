import { useCallback, useEffect, useRef, useState } from 'react';
import { callFunction } from '@shared/lib/api';
import { pickRecorderMime } from '@shared/lib/audio-wav';
import { formatRecordingClock, normalizeCompanionAudioMime } from './patient-chat.utils';

export type CompanionAudioState = 'idle' | 'recording' | 'transcribing';

const MAX_SECONDS = 90;
const MIN_SECONDS = 1;

interface UseCompanionAudioOptions {
  patientId: string;
  disabled?: boolean;
  onTranscribed: (text: string) => void;
  onError?: (message: string) => void;
}

function permissionErrorMessage(err: unknown): string {
  const name = err instanceof DOMException ? err.name : '';
  if (name === 'NotAllowedError' || name === 'PermissionDeniedError') {
    return 'Precisamos do microfone. Ative a permissão nas configurações do navegador.';
  }
  if (name === 'NotFoundError') {
    return 'Nenhum microfone encontrado neste aparelho.';
  }
  return 'Não foi possível começar a gravar. Tente de novo.';
}

export function useCompanionAudio({
  patientId,
  disabled = false,
  onTranscribed,
  onError,
}: UseCompanionAudioOptions) {
  const [state, setState] = useState<CompanionAudioState>('idle');
  const [duration, setDuration] = useState(0);
  const [waveHeights, setWaveHeights] = useState([8, 14, 22, 14, 8, 16, 10]);

  const mediaRecorderRef = useRef<MediaRecorder | null>(null);
  const chunksRef = useRef<Blob[]>([]);
  const timerRef = useRef<number | null>(null);
  const streamRef = useRef<MediaStream | null>(null);
  const durationRef = useRef(0);
  const mimeRef = useRef('audio/webm');
  const holdingRef = useRef(false);
  const startingRef = useRef(false);

  const cleanupStream = useCallback(() => {
    if (timerRef.current) {
      clearInterval(timerRef.current);
      timerRef.current = null;
    }
    streamRef.current?.getTracks().forEach((track) => track.stop());
    streamRef.current = null;
    mediaRecorderRef.current = null;
  }, []);

  useEffect(() => () => cleanupStream(), [cleanupStream]);

  useEffect(() => {
    if (state !== 'recording') return;
    const id = window.setInterval(() => {
      setWaveHeights((prev) =>
        prev.map((height) => Math.min(28, Math.max(6, height + (Math.random() - 0.5) * 12))),
      );
    }, 110);
    return () => clearInterval(id);
  }, [state]);

  const transcribe = useCallback(
    async (blob: Blob, recordedSeconds: number) => {
      setState('transcribing');
      try {
        const mimeType = normalizeCompanionAudioMime(mimeRef.current);
        const initiate = await callFunction<{
          upload_url: string;
          storage_path: string;
        }>('process-family-audio', {
          step: 'initiate',
          patient_id: patientId,
          mime_type: mimeType,
          duration_seconds: Math.max(MIN_SECONDS, recordedSeconds),
        });

        const upload = await fetch(initiate.upload_url, {
          method: 'PUT',
          headers: { 'Content-Type': mimeType },
          body: blob,
        });
        if (!upload.ok) {
          throw new Error('Falha ao enviar o áudio.');
        }

        const complete = await callFunction<{ transcricao: string }>('process-family-audio', {
          step: 'complete',
          patient_id: patientId,
          storage_path: initiate.storage_path,
          mime_type: mimeType,
          duration_seconds: Math.max(MIN_SECONDS, recordedSeconds),
        });

        const text = complete.transcricao.trim();
        if (!text) {
          throw new Error('Não deu para entender o áudio. Tente falar de novo.');
        }

        setState('idle');
        setDuration(0);
        durationRef.current = 0;
        onTranscribed(text);
      } catch (err) {
        setState('idle');
        setDuration(0);
        durationRef.current = 0;
        onError?.(err instanceof Error ? err.message : 'Falha ao transcrever o áudio.');
      }
    },
    [onError, onTranscribed, patientId],
  );

  const finishRecording = useCallback(
    async (shouldSend: boolean) => {
      const recorder = mediaRecorderRef.current;
      const recordedSeconds = durationRef.current;
      const recordedType = mimeRef.current;

      if (recorder && recorder.state !== 'inactive') {
        await new Promise<void>((resolve) => {
          recorder.onstop = () => resolve();
          recorder.stop();
        });
      }

      cleanupStream();
      const blob = new Blob(chunksRef.current, { type: recordedType });
      chunksRef.current = [];

      if (!shouldSend) {
        setState('idle');
        setDuration(0);
        durationRef.current = 0;
        return;
      }

      if (blob.size === 0 || recordedSeconds < MIN_SECONDS) {
        setState('idle');
        setDuration(0);
        durationRef.current = 0;
        onError?.('Segure o microfone um pouco mais para gravar.');
        return;
      }

      await transcribe(blob, recordedSeconds);
    },
    [cleanupStream, onError, transcribe],
  );

  const startHold = useCallback(async () => {
    if (disabled || startingRef.current || state !== 'idle') return;
    holdingRef.current = true;
    startingRef.current = true;

    try {
      const stream = await navigator.mediaDevices.getUserMedia({ audio: true });
      if (!holdingRef.current) {
        stream.getTracks().forEach((track) => track.stop());
        startingRef.current = false;
        return;
      }

      streamRef.current = stream;
      const recorderMime = pickRecorderMime();
      mimeRef.current = recorderMime ?? 'audio/webm';
      const recorder = new MediaRecorder(stream, recorderMime ? { mimeType: recorderMime } : undefined);
      mediaRecorderRef.current = recorder;
      chunksRef.current = [];
      recorder.ondataavailable = (event) => {
        if (event.data.size > 0) chunksRef.current.push(event.data);
      };
      recorder.start(250);

      setState('recording');
      setDuration(0);
      durationRef.current = 0;
      timerRef.current = window.setInterval(() => {
        durationRef.current += 1;
        setDuration(durationRef.current);
        if (durationRef.current >= MAX_SECONDS) {
          holdingRef.current = false;
          void finishRecording(true);
        }
      }, 1000);
    } catch (err) {
      holdingRef.current = false;
      onError?.(permissionErrorMessage(err));
      setState('idle');
    } finally {
      startingRef.current = false;
    }
  }, [disabled, finishRecording, onError, state]);

  const stopHold = useCallback(
    (shouldSend = true) => {
      holdingRef.current = false;
      if (startingRef.current) return;
      if (state !== 'recording') return;
      void finishRecording(shouldSend);
    },
    [finishRecording, state],
  );

  const cancelHold = useCallback(() => {
    holdingRef.current = false;
    if (state !== 'recording') return;
    void finishRecording(false);
  }, [finishRecording, state]);

  return {
    state,
    duration,
    durationLabel: formatRecordingClock(duration),
    waveHeights,
    isBusy: state !== 'idle',
    startHold,
    stopHold,
    cancelHold,
  };
}
