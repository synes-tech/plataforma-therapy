import { useState, useRef, useCallback, useEffect } from 'react';
import { useMutation } from '@tanstack/react-query';
import { callFunction } from '@shared/lib/api';
import { blobToWav, pickRecorderMime } from '@shared/lib/audio-wav';

interface AudioRecorderProps {
  patientId: string;
  recordingType: 'onboarding' | 'post_session' | 'note';
  onComplete?: (jobId: string) => void;
}

type RecordingState = 'idle' | 'recording' | 'uploading' | 'processing' | 'done' | 'error';

export function AudioRecorder({ patientId, recordingType, onComplete }: AudioRecorderProps) {
  const [state, setState] = useState<RecordingState>('idle');
  const [duration, setDuration] = useState(0);
  const [error, setError] = useState<string | null>(null);

  const mediaRecorderRef = useRef<MediaRecorder | null>(null);
  const chunksRef = useRef<Blob[]>([]);
  const timerRef = useRef<number | null>(null);
  const streamRef = useRef<MediaStream | null>(null);

  // Cleanup on unmount
  useEffect(() => {
    return () => {
      if (timerRef.current) clearInterval(timerRef.current);
      if (streamRef.current) {
        streamRef.current.getTracks().forEach((t) => t.stop());
      }
    };
  }, []);

  const startRecording = useCallback(async () => {
    try {
      setError(null);
      const stream = await navigator.mediaDevices.getUserMedia({ audio: true });
      streamRef.current = stream;

      const recorderMime = pickRecorderMime();
      const mediaRecorder = new MediaRecorder(stream, recorderMime ? { mimeType: recorderMime } : undefined);
      mediaRecorderRef.current = mediaRecorder;
      chunksRef.current = [];

      mediaRecorder.ondataavailable = (e) => {
        if (e.data.size > 0) chunksRef.current.push(e.data);
      };

      mediaRecorder.start(1000); // Collect data every second
      setState('recording');
      setDuration(0);

      timerRef.current = window.setInterval(() => {
        setDuration((d) => d + 1);
      }, 1000);
    } catch {
      setError('Permissão de microfone negada. Verifique as configurações do navegador.');
      setState('error');
    }
  }, []);

  const stopRecording = useCallback(() => {
    if (mediaRecorderRef.current && state === 'recording') {
      mediaRecorderRef.current.stop();
      if (timerRef.current) clearInterval(timerRef.current);
      if (streamRef.current) {
        streamRef.current.getTracks().forEach((t) => t.stop());
      }
      setState('uploading');

      // Process after a short delay to ensure all chunks are collected
      setTimeout(() => uploadAudio(), 200);
    }
  }, [state]);

  // Upload mutation
  const uploadMutation = useMutation({
    mutationFn: async (audioBlob: Blob) => {
      // 1. Get signed upload URL
      const response = await callFunction<{
        audio_recording_id: string;
        upload_url: string;
        job_id: string;
      }>('upload-audio', {
        patient_id: patientId,
        recording_type: recordingType,
        duration_seconds: duration,
      });

      // 2. Convert to WAV (Gemini-compatible) and upload directly to Storage
      const wavBlob = await blobToWav(audioBlob);
      const uploadResponse = await fetch(response.upload_url, {
        method: 'PUT',
        headers: { 'Content-Type': 'audio/wav' },
        body: wavBlob,
      });

      if (!uploadResponse.ok) {
        throw new Error('Failed to upload audio file');
      }

      return response;
    },
    onSuccess: (data) => {
      setState('processing');
      onComplete?.(data.job_id);
    },
    onError: (err: Error) => {
      setError(err.message);
      setState('error');
    },
  });

  function uploadAudio() {
    const recordedType = mediaRecorderRef.current?.mimeType || 'audio/webm';
    const blob = new Blob(chunksRef.current, { type: recordedType });
    uploadMutation.mutate(blob);
  }

  function formatTime(seconds: number): string {
    const mins = Math.floor(seconds / 60);
    const secs = seconds % 60;
    return `${mins.toString().padStart(2, '0')}:${secs.toString().padStart(2, '0')}`;
  }

  return (
    <div className="glass-card p-6">
      <h3 className="mb-4 text-sm font-medium text-text">
        {recordingType === 'post_session' ? 'Ditado de Pós-Consulta' : 'Gravação de Áudio'}
      </h3>

      {/* Error */}
      {error && (
        <div role="alert" className="mb-4 rounded-lg border border-error/20 bg-error/10 px-3 py-2 text-sm text-error">
          {error}
          <button onClick={() => { setError(null); setState('idle'); }} className="ml-2 underline">
            Tentar novamente
          </button>
        </div>
      )}

      {/* Recording UI */}
      <div className="flex flex-col items-center gap-4">
        {/* Waveform indicator */}
        {state === 'recording' && (
          <div className="flex items-center gap-1" aria-label="Gravando áudio">
            {[...Array(5)].map((_, i) => (
              <div
                key={i}
                className="w-1 animate-pulse rounded-full bg-error"
                style={{
                  height: `${12 + Math.random() * 20}px`,
                  animationDelay: `${i * 0.15}s`,
                  animationDuration: '0.8s',
                }}
              />
            ))}
          </div>
        )}

        {/* Timer */}
        {(state === 'recording' || state === 'uploading') && (
          <p className="font-mono text-2xl text-text" aria-live="polite">
            {formatTime(duration)}
          </p>
        )}

        {/* Status messages */}
        {state === 'uploading' && (
          <p className="text-sm text-text-muted">Enviando áudio...</p>
        )}
        {state === 'processing' && (
          <div className="text-center">
            <div className="mx-auto mb-2 h-6 w-6 animate-spin rounded-full border-2 border-ai border-t-transparent" />
            <p className="text-sm text-ai-light">IA processando transcrição...</p>
            <p className="mt-1 text-xs text-text-muted">Você será notificado quando estiver pronto</p>
          </div>
        )}
        {state === 'done' && (
          <div className="text-center">
            <p className="text-sm text-success">✓ Relatório gerado e aguardando revisão</p>
          </div>
        )}

        {/* Main action button */}
        {state === 'idle' && (
          <button
            onClick={startRecording}
            className="flex h-16 w-16 items-center justify-center rounded-full bg-error/90 text-white shadow-lg transition-transform hover:scale-105 hover:bg-error active:scale-95"
            aria-label="Iniciar gravação"
          >
            <svg className="h-6 w-6" viewBox="0 0 24 24" fill="currentColor">
              <path d="M12 14c1.66 0 3-1.34 3-3V5c0-1.66-1.34-3-3-3S9 3.34 9 5v6c0 1.66 1.34 3 3 3z" />
              <path d="M17 11c0 2.76-2.24 5-5 5s-5-2.24-5-5H5c0 3.53 2.61 6.43 6 6.92V21h2v-3.08c3.39-.49 6-3.39 6-6.92h-2z" />
            </svg>
          </button>
        )}

        {state === 'recording' && (
          <button
            onClick={stopRecording}
            className="flex h-16 w-16 items-center justify-center rounded-full bg-surface-light ring-4 ring-error/50 transition-transform hover:scale-105 active:scale-95"
            aria-label="Parar gravação"
          >
            <div className="h-5 w-5 rounded-sm bg-error" />
          </button>
        )}
      </div>

      {/* Instructions */}
      {state === 'idle' && (
        <p className="mt-4 text-center text-xs text-text-muted">
          Pressione para gravar suas observações da sessão. A IA gerará o relatório estruturado automaticamente.
        </p>
      )}
    </div>
  );
}
