import { useCallback, useEffect, useRef, useState } from 'react';
import { useMutation } from '@tanstack/react-query';
import { callFunction } from '@shared/lib/api';
import { supabase } from '@shared/lib/supabase';
import { blobToWav, pickRecorderMime } from '@shared/lib/audio-wav';

type RecorderState = 'idle' | 'recording' | 'uploading' | 'processing' | 'done' | 'error';

interface ClinicalReturnRecorderProps {
  patientId: string;
  patientName: string;
  /** Called when transcription is complete */
  onTranscribed?: (cleanedText: string) => void;
}

function formatTime(seconds: number): string {
  const mins = Math.floor(seconds / 60);
  const secs = seconds % 60;
  return `${mins.toString().padStart(2, '0')}:${secs.toString().padStart(2, '0')}`;
}

export function ClinicalReturnRecorder({ patientId, patientName, onTranscribed }: ClinicalReturnRecorderProps) {
  const [state, setState] = useState<RecorderState>('idle');
  const [duration, setDuration] = useState(0);
  const [error, setError] = useState<string | null>(null);
  const [permissionDenied, setPermissionDenied] = useState(false);
  const [cleanedText, setCleanedText] = useState<string | null>(null);
  const [analyserData, setAnalyserData] = useState<number[]>(new Array(24).fill(0));

  const mediaRecorderRef = useRef<MediaRecorder | null>(null);
  const chunksRef = useRef<Blob[]>([]);
  const timerRef = useRef<number | null>(null);
  const streamRef = useRef<MediaStream | null>(null);
  const jobIdRef = useRef<string | null>(null);
  const analyserRef = useRef<AnalyserNode | null>(null);
  const audioContextRef = useRef<AudioContext | null>(null);
  const animFrameRef = useRef<number | null>(null);

  // Reset on patient change
  useEffect(() => {
    setState('idle');
    setDuration(0);
    setError(null);
    setCleanedText(null);
    jobIdRef.current = null;
  }, [patientId]);

  // Cleanup
  useEffect(() => {
    return () => {
      if (timerRef.current) clearInterval(timerRef.current);
      if (streamRef.current) streamRef.current.getTracks().forEach((t) => t.stop());
      if (animFrameRef.current) cancelAnimationFrame(animFrameRef.current);
      if (audioContextRef.current) audioContextRef.current.close();
    };
  }, []);

  // Realtime: listen for ai_jobs completion
  useEffect(() => {
    if (state !== 'processing') return;

    const channel = supabase
      .channel(`clinical-return-${patientId}`)
      .on(
        'postgres_changes',
        { event: 'UPDATE', schema: 'public', table: 'ai_jobs', filter: `patient_id=eq.${patientId}` },
        (payload) => {
          const job = payload.new as { id: string; status: string; output_data?: { cleaned_text?: string } };
          if (jobIdRef.current && job.id !== jobIdRef.current) return;
          if (job.status === 'failed') {
            setError('A IA não conseguiu processar o áudio. Tente novamente.');
            setState('error');
            return;
          }
          if (job.status === 'completed' && job.output_data?.cleaned_text) {
            setCleanedText(job.output_data.cleaned_text);
            setState('done');
            onTranscribed?.(job.output_data.cleaned_text);
          }
        },
      )
      .subscribe();

    return () => {
      supabase.removeChannel(channel);
    };
  }, [state, patientId, onTranscribed]);

  // Analyser animation loop
  const startAnalyser = useCallback((stream: MediaStream) => {
    const AudioCtx = window.AudioContext || (window as unknown as { webkitAudioContext: typeof AudioContext }).webkitAudioContext;
    const ctx = new AudioCtx();
    audioContextRef.current = ctx;
    const source = ctx.createMediaStreamSource(stream);
    const analyser = ctx.createAnalyser();
    analyser.fftSize = 64;
    analyser.smoothingTimeConstant = 0.7;
    source.connect(analyser);
    analyserRef.current = analyser;

    const bufferLength = analyser.frequencyBinCount;
    const dataArray = new Uint8Array(bufferLength);

    function tick() {
      analyser.getByteFrequencyData(dataArray);
      // Pick 24 bars, normalize to 0–1
      const bars: number[] = [];
      const step = Math.floor(bufferLength / 24);
      for (let i = 0; i < 24; i++) {
        bars.push((dataArray[i * step] ?? 0) / 255);
      }
      setAnalyserData(bars);
      animFrameRef.current = requestAnimationFrame(tick);
    }
    tick();
  }, []);

  const startRecording = useCallback(async () => {
    try {
      setError(null);
      setPermissionDenied(false);
      setCleanedText(null);
      const stream = await navigator.mediaDevices.getUserMedia({ audio: true });
      streamRef.current = stream;

      startAnalyser(stream);

      const recorderMime = pickRecorderMime();
      const mediaRecorder = new MediaRecorder(stream, recorderMime ? { mimeType: recorderMime } : undefined);
      mediaRecorderRef.current = mediaRecorder;
      chunksRef.current = [];
      mediaRecorder.ondataavailable = (e) => {
        if (e.data.size > 0) chunksRef.current.push(e.data);
      };
      mediaRecorder.start(1000);
      setState('recording');
      setDuration(0);
      timerRef.current = window.setInterval(() => setDuration((d) => d + 1), 1000);
    } catch {
      setPermissionDenied(true);
      setError('Precisamos de acesso ao microfone para gravar o retorno clínico.');
      setState('error');
    }
  }, [startAnalyser]);

  const uploadMutation = useMutation({
    mutationFn: async (audioBlob: Blob) => {
      const response = await callFunction<{ audio_recording_id: string; upload_url: string; job_id: string }>(
        'upload-audio',
        { patient_id: patientId, recording_type: 'clinical_return', duration_seconds: duration },
      );
      const wavBlob = await blobToWav(audioBlob);
      const uploadResponse = await fetch(response.upload_url, {
        method: 'PUT',
        headers: { 'Content-Type': 'audio/wav' },
        body: wavBlob,
      });
      if (!uploadResponse.ok) throw new Error('Falha ao enviar o áudio.');
      return response;
    },
    onSuccess: (data) => {
      jobIdRef.current = data.job_id;
      setState('processing');
    },
    onError: (err: Error) => {
      setError(err.message);
      setState('error');
    },
  });

  const stopRecording = useCallback(() => {
    if (mediaRecorderRef.current && state === 'recording') {
      mediaRecorderRef.current.stop();
      if (timerRef.current) clearInterval(timerRef.current);
      if (streamRef.current) streamRef.current.getTracks().forEach((t) => t.stop());
      if (animFrameRef.current) cancelAnimationFrame(animFrameRef.current);
      if (audioContextRef.current) {
        audioContextRef.current.close();
        audioContextRef.current = null;
      }
      setAnalyserData(new Array(24).fill(0));
      setState('uploading');
      const recordedType = mediaRecorderRef.current?.mimeType || 'audio/webm';
      setTimeout(() => {
        const blob = new Blob(chunksRef.current, { type: recordedType });
        uploadMutation.mutate(blob);
      }, 200);
    }
  }, [state, uploadMutation]);

  const resetRecorder = useCallback(() => {
    setState('idle');
    setDuration(0);
    setError(null);
    setCleanedText(null);
    jobIdRef.current = null;
  }, []);

  return (
    <div className="overflow-hidden rounded-2xl border border-slate-700/80 bg-slate-900 shadow-lg">
      {/* Header */}
      <div className="border-b border-slate-700/60 px-4 py-4 lg:px-6">
        <div className="flex items-center gap-3">
          <div className="flex h-8 w-8 items-center justify-center rounded-full bg-white/10 backdrop-blur-sm">
            <svg className="h-4 w-4 text-primary-light" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
              <path strokeLinecap="round" strokeLinejoin="round" d="M19 11a7 7 0 01-7 7m0 0a7 7 0 01-7-7m7 7v4m0 0H8m4 0h4m-4-8a3 3 0 01-3-3V5a3 3 0 116 0v6a3 3 0 01-3 3z" />
            </svg>
          </div>
          <div>
            <h3 className="text-sm font-semibold text-white">Retorno Clínico</h3>
            <p className="text-xs text-white/50">{patientName}</p>
          </div>
        </div>
      </div>

      {/* Body */}
      <div className="px-4 py-5 lg:px-6 lg:py-6">
        {/* Permission denied alert */}
        {permissionDenied && (
          <div
            role="alert"
            className="mb-5 rounded-xl border border-amber-400/20 bg-amber-500/10 px-4 py-3 backdrop-blur-sm"
          >
            <p className="text-xs font-medium text-amber-300">Microfone bloqueado</p>
            <p className="mt-0.5 text-[11px] text-amber-300/70">
              Libere o acesso ao microfone nas configurações do navegador e tente novamente.
            </p>
          </div>
        )}

        {/* IDLE state */}
        {state === 'idle' && (
          <div className="flex flex-col items-center py-4">
            <button
              type="button"
              onClick={startRecording}
              className="group relative flex h-[4.75rem] min-h-[44px] w-[4.75rem] min-w-[44px] items-center justify-center rounded-full bg-white/10 text-white shadow-lg backdrop-blur-sm transition-all duration-300 hover:bg-white/15 hover:shadow-ai-glow active:scale-95"
              aria-label="Iniciar gravação de retorno clínico"
            >
              {/* Glow ring on hover */}
              <span className="absolute inset-0 rounded-full border border-white/20 transition-all duration-300 group-hover:border-primary/40 group-hover:shadow-[inset_0_0_20px_rgba(26,134,226,0.1)]" />
              <svg className="h-8 w-8" viewBox="0 0 24 24" fill="currentColor">
                <path d="M12 14c1.66 0 3-1.34 3-3V5c0-1.66-1.34-3-3-3S9 3.34 9 5v6c0 1.66 1.34 3 3 3z" />
                <path d="M17 11c0 2.76-2.24 5-5 5s-5-2.24-5-5H5c0 3.53 2.61 6.43 6 6.92V21h2v-3.08c3.39-.49 6-3.39 6-6.92h-2z" />
              </svg>
            </button>
            <p className="mt-4 text-xs text-white/50">
              Clique para ditar suas observações clínicas
            </p>
          </div>
        )}

        {/* RECORDING state — waveform + timer */}
        {state === 'recording' && (
          <div className="flex flex-col items-center py-4">
            {/* Waveform visualizer */}
            <div className="mb-5 flex h-12 items-end justify-center gap-[2px]" aria-label="Visualizador de áudio">
              {analyserData.map((val, i) => (
                <div
                  key={i}
                  className="w-[3px] rounded-full bg-gradient-to-t from-primary to-primary-light transition-all duration-75"
                  style={{ height: `${Math.max(4, val * 48)}px`, opacity: 0.6 + val * 0.4 }}
                />
              ))}
            </div>

            {/* Timer */}
            <p className="mb-5 font-mono text-3xl font-light tracking-widest text-white" aria-live="polite">
              {formatTime(duration)}
            </p>

            {/* Stop button */}
            <span className="relative inline-flex">
              <span className="absolute inset-0 animate-ping rounded-full bg-red-500/20" />
              <button
                type="button"
                onClick={stopRecording}
                className="relative flex h-16 min-h-[44px] w-16 min-w-[44px] items-center justify-center rounded-full bg-red-500/90 text-white shadow-xl transition-transform hover:scale-105 active:scale-95"
                aria-label="Parar gravação"
              >
                <span className="h-5 w-5 rounded-sm bg-white" />
              </button>
            </span>
            <p className="mt-3 text-xs text-white/40">Gravando... clique para finalizar</p>
          </div>
        )}

        {/* UPLOADING state */}
        {state === 'uploading' && (
          <div className="flex flex-col items-center py-8 text-center">
            <div className="h-10 w-10 animate-spin rounded-full border-[3px] border-primary/30 border-t-primary" />
            <p className="mt-4 text-sm text-white/70">Enviando áudio com segurança...</p>
          </div>
        )}

        {/* PROCESSING state */}
        {state === 'processing' && (
          <div className="flex flex-col items-center py-8 text-center">
            <div className="relative mb-4 h-12 w-12">
              <div className="absolute inset-0 animate-spin rounded-full border-[3px] border-ai/30 border-t-ai" />
              <div className="absolute inset-2 animate-spin rounded-full border-[2px] border-primary/20 border-b-primary" style={{ animationDirection: 'reverse', animationDuration: '1.5s' }} />
            </div>
            <p className="bg-gradient-to-r from-primary-light to-ai-light bg-clip-text text-sm font-medium text-transparent">
              A IA está transcrevendo e limpando o texto...
            </p>
            <p className="mt-1 text-xs text-white/40">Removendo vícios de linguagem e formatando.</p>
          </div>
        )}

        {/* DONE state — show transcription */}
        {state === 'done' && cleanedText && (
          <div className="animate-fade-in">
            <div className="mb-3 flex items-center gap-2">
              <div className="flex h-5 w-5 items-center justify-center rounded-full bg-emerald-500/20">
                <svg className="h-3 w-3 text-emerald-400" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={3}>
                  <path strokeLinecap="round" strokeLinejoin="round" d="M5 13l4 4L19 7" />
                </svg>
              </div>
              <span className="text-xs font-medium text-emerald-400">Transcrição concluída</span>
            </div>

            <div className="max-h-48 overflow-y-auto rounded-xl border border-white/10 bg-white/5 p-4 backdrop-blur-sm">
              <p className="whitespace-pre-wrap text-sm leading-relaxed text-white/80">
                {cleanedText}
              </p>
            </div>

            <button
              onClick={resetRecorder}
              className="mt-4 inline-flex items-center gap-1.5 rounded-lg border border-white/10 px-3 py-1.5 text-xs font-medium text-white/60 transition-colors hover:border-white/20 hover:text-white/80"
            >
              <svg className="h-3.5 w-3.5" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                <path strokeLinecap="round" strokeLinejoin="round" d="M4 4v5h5M20 20v-5h-5M5 19a9 9 0 0014-6M19 5a9 9 0 00-14 6" />
              </svg>
              Gravar novo retorno
            </button>
          </div>
        )}

        {/* ERROR state */}
        {state === 'error' && (
          <div className="flex flex-col items-center py-6 text-center">
            <p className="mb-3 text-xs text-red-400/80">{error ?? 'Algo deu errado.'}</p>
            <button
              onClick={resetRecorder}
              className="inline-flex items-center gap-1.5 rounded-lg border border-white/10 px-3 py-2 text-xs font-medium text-white/60 transition-colors hover:border-white/20 hover:text-white/80"
            >
              Tentar novamente
            </button>
          </div>
        )}
      </div>
    </div>
  );
}
