import { useCallback, useEffect, useRef, useState } from 'react';
import { callFunction } from '@shared/lib/api';
import { blobToWav, pickRecorderMime } from '@shared/lib/audio-wav';

export type CopilotAudioInputState = 'idle' | 'recording' | 'transcribing';

interface InitiateResponse {
  step: 'initiate';
  upload_url: string;
  storage_path: string;
  mime_type: string;
}

interface CompleteResponse {
  step: 'complete';
  transcription: string;
}

interface UseCopilotAudioInputOptions {
  patientId: string;
  disabled?: boolean;
  onTranscribed: (text: string) => void;
  onError?: (message: string) => void;
  onPaymentRequired?: () => void;
}

function formatDuration(seconds: number): string {
  const mins = Math.floor(seconds / 60);
  const secs = seconds % 60;
  return `${mins}:${secs.toString().padStart(2, '0')}`;
}

export function useCopilotAudioInput({
  patientId,
  disabled = false,
  onTranscribed,
  onError,
  onPaymentRequired,
}: UseCopilotAudioInputOptions) {
  const [state, setState] = useState<CopilotAudioInputState>('idle');
  const [duration, setDuration] = useState(0);

  const mediaRecorderRef = useRef<MediaRecorder | null>(null);
  const chunksRef = useRef<Blob[]>([]);
  const timerRef = useRef<number | null>(null);
  const streamRef = useRef<MediaStream | null>(null);
  const durationRef = useRef(0);

  const cleanupStream = useCallback(() => {
    if (timerRef.current) {
      clearInterval(timerRef.current);
      timerRef.current = null;
    }
    if (streamRef.current) {
      streamRef.current.getTracks().forEach((track) => track.stop());
      streamRef.current = null;
    }
    mediaRecorderRef.current = null;
  }, []);

  useEffect(() => {
    setState('idle');
    setDuration(0);
    durationRef.current = 0;
    cleanupStream();
    chunksRef.current = [];
  }, [patientId, cleanupStream]);

  useEffect(() => cleanupStream, [cleanupStream]);

  const handleError = useCallback(
    (message: string, code?: string) => {
      cleanupStream();
      chunksRef.current = [];
      setState('idle');
      setDuration(0);
      durationRef.current = 0;
      if (code === 'PAYMENT_REQUIRED') {
        onPaymentRequired?.();
        return;
      }
      onError?.(message);
    },
    [cleanupStream, onError, onPaymentRequired],
  );

  const uploadAndTranscribe = useCallback(
    async (audioBlob: Blob, recordedSeconds: number) => {
      setState('transcribing');

      try {
        const initiate = await callFunction<InitiateResponse>('transcribe-copilot-audio', {
          step: 'initiate',
          patient_id: patientId,
          mime_type: 'audio/wav',
          duration_seconds: Math.max(1, recordedSeconds),
        });

        const wavBlob = await blobToWav(audioBlob);
        const uploadResponse = await fetch(initiate.upload_url, {
          method: 'PUT',
          headers: { 'Content-Type': 'audio/wav' },
          body: wavBlob,
        });

        if (!uploadResponse.ok) {
          throw new Error('Falha ao enviar o áudio.');
        }

        const complete = await callFunction<CompleteResponse>('transcribe-copilot-audio', {
          step: 'complete',
          patient_id: patientId,
          storage_path: initiate.storage_path,
          mime_type: initiate.mime_type,
          duration_seconds: Math.max(1, recordedSeconds),
        });

        const text = complete.transcription.trim();
        if (!text) {
          throw new Error('Não foi possível transcrever o áudio.');
        }

        setState('idle');
        setDuration(0);
        durationRef.current = 0;
        onTranscribed(text);
      } catch (err) {
        const error = err as Error & { code?: string };
        handleError(error.message ?? 'Falha ao transcrever o áudio.', error.code);
      }
    },
    [handleError, onTranscribed, patientId],
  );

  const stopRecording = useCallback(async () => {
    if (state !== 'recording' || !mediaRecorderRef.current) return;

    const recordedSeconds = durationRef.current;
    const recordedType = mediaRecorderRef.current.mimeType || 'audio/webm';

    await new Promise<void>((resolve) => {
      const recorder = mediaRecorderRef.current!;
      recorder.onstop = () => resolve();
      recorder.stop();
    });

    if (timerRef.current) {
      clearInterval(timerRef.current);
      timerRef.current = null;
    }
    if (streamRef.current) {
      streamRef.current.getTracks().forEach((track) => track.stop());
      streamRef.current = null;
    }
    mediaRecorderRef.current = null;

    const blob = new Blob(chunksRef.current, { type: recordedType });
    chunksRef.current = [];

    if (blob.size === 0 || recordedSeconds < 1) {
      handleError('Gravação muito curta. Tente novamente.');
      return;
    }

    await uploadAndTranscribe(blob, recordedSeconds);
  }, [handleError, state, uploadAndTranscribe]);

  const startRecording = useCallback(async () => {
    if (disabled || state !== 'idle') return;

    try {
      const stream = await navigator.mediaDevices.getUserMedia({ audio: true });
      streamRef.current = stream;

      const recorderMime = pickRecorderMime();
      const mediaRecorder = new MediaRecorder(stream, recorderMime ? { mimeType: recorderMime } : undefined);
      mediaRecorderRef.current = mediaRecorder;
      chunksRef.current = [];

      mediaRecorder.ondataavailable = (event) => {
        if (event.data.size > 0) chunksRef.current.push(event.data);
      };

      mediaRecorder.start(1000);
      setState('recording');
      setDuration(0);
      durationRef.current = 0;
      timerRef.current = window.setInterval(() => {
        durationRef.current += 1;
        setDuration(durationRef.current);
        if (durationRef.current >= 179) {
          void stopRecording();
        }
      }, 1000);
    } catch {
      handleError('Precisamos de acesso ao microfone para gravar a mensagem.');
    }
  }, [disabled, handleError, state, stopRecording]);

  const cancelRecording = useCallback(() => {
    if (state !== 'recording') return;
    if (mediaRecorderRef.current?.state === 'recording') {
      mediaRecorderRef.current.stop();
    }
    cleanupStream();
    chunksRef.current = [];
    setState('idle');
    setDuration(0);
    durationRef.current = 0;
  }, [cleanupStream, state]);

  return {
    state,
    duration,
    durationLabel: formatDuration(duration),
    isBusy: state !== 'idle',
    startRecording,
    stopRecording,
    cancelRecording,
  };
}
