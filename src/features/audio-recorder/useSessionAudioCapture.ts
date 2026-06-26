import { useState, useRef, useCallback, useEffect } from 'react';
import { pickRecorderMime } from '@shared/lib/audio-wav';

export type AudioCaptureState = 'idle' | 'recording' | 'paused' | 'stopped' | 'error';

export interface UseSessionAudioCaptureResult {
  state: AudioCaptureState;
  duration: number;
  audioBlob: Blob | null;
  error: string | null;
  isRecording: boolean;
  isPaused: boolean;
  startRecording: () => Promise<void>;
  stopRecording: () => Promise<Blob | null>;
  pauseRecording: () => void;
  resumeRecording: () => void;
  resetCapture: () => void;
}

export function formatCaptureTime(seconds: number): string {
  const mins = Math.floor(seconds / 60);
  const secs = seconds % 60;
  return `${mins.toString().padStart(2, '0')}:${secs.toString().padStart(2, '0')}`;
}

export function useSessionAudioCapture(): UseSessionAudioCaptureResult {
  const [state, setState] = useState<AudioCaptureState>('idle');
  const [duration, setDuration] = useState(0);
  const [audioBlob, setAudioBlob] = useState<Blob | null>(null);
  const [error, setError] = useState<string | null>(null);

  const mediaRecorderRef = useRef<MediaRecorder | null>(null);
  const chunksRef = useRef<Blob[]>([]);
  const timerRef = useRef<number | null>(null);
  const streamRef = useRef<MediaStream | null>(null);
  const stopResolveRef = useRef<((blob: Blob | null) => void) | null>(null);

  const clearTimer = useCallback(() => {
    if (timerRef.current) {
      clearInterval(timerRef.current);
      timerRef.current = null;
    }
  }, []);

  const releaseStream = useCallback(() => {
    if (streamRef.current) {
      streamRef.current.getTracks().forEach((track) => track.stop());
      streamRef.current = null;
    }
  }, []);

  useEffect(() => {
    return () => {
      clearTimer();
      releaseStream();
    };
  }, [clearTimer, releaseStream]);

  const resetCapture = useCallback(() => {
    clearTimer();
    releaseStream();
    mediaRecorderRef.current = null;
    chunksRef.current = [];
    stopResolveRef.current = null;
    setState('idle');
    setDuration(0);
    setAudioBlob(null);
    setError(null);
  }, [clearTimer, releaseStream]);

  const startRecording = useCallback(async () => {
    try {
      setError(null);
      setAudioBlob(null);
      chunksRef.current = [];

      const stream = await navigator.mediaDevices.getUserMedia({ audio: true });
      streamRef.current = stream;

      const recorderMime = pickRecorderMime();
      const mediaRecorder = new MediaRecorder(stream, recorderMime ? { mimeType: recorderMime } : undefined);
      mediaRecorderRef.current = mediaRecorder;

      mediaRecorder.ondataavailable = (event) => {
        if (event.data.size > 0) chunksRef.current.push(event.data);
      };

      mediaRecorder.onstop = () => {
        clearTimer();
        releaseStream();

        const recordedType = mediaRecorder.mimeType || 'audio/webm';
        const blob =
          chunksRef.current.length > 0
            ? new Blob(chunksRef.current, { type: recordedType })
            : null;

        setAudioBlob(blob);
        setState(blob ? 'stopped' : 'idle');
        stopResolveRef.current?.(blob);
        stopResolveRef.current = null;
      };

      mediaRecorder.start(1000);
      setState('recording');
      setDuration(0);

      timerRef.current = window.setInterval(() => {
        setDuration((current) => current + 1);
      }, 1000);
    } catch {
      setError('Permissão de microfone negada. Verifique as configurações do navegador.');
      setState('error');
    }
  }, [clearTimer, releaseStream]);

  const stopRecording = useCallback((): Promise<Blob | null> => {
    const recorder = mediaRecorderRef.current;
    if (!recorder || (state !== 'recording' && state !== 'paused')) {
      return Promise.resolve(audioBlob);
    }

    return new Promise((resolve) => {
      stopResolveRef.current = resolve;
      recorder.stop();
    });
  }, [audioBlob, state]);

  const pauseRecording = useCallback(() => {
    const recorder = mediaRecorderRef.current;
    if (!recorder || state !== 'recording' || recorder.state !== 'recording') return;

    recorder.pause();
    clearTimer();
    setState('paused');
  }, [clearTimer, state]);

  const resumeRecording = useCallback(() => {
    const recorder = mediaRecorderRef.current;
    if (!recorder || state !== 'paused' || recorder.state !== 'paused') return;

    recorder.resume();
    setState('recording');
    timerRef.current = window.setInterval(() => {
      setDuration((current) => current + 1);
    }, 1000);
  }, [state]);

  return {
    state,
    duration,
    audioBlob,
    error,
    isRecording: state === 'recording',
    isPaused: state === 'paused',
    startRecording,
    stopRecording,
    pauseRecording,
    resumeRecording,
    resetCapture,
  };
}
