import { useCallback, useEffect, useRef, useState } from 'react';
import { useMutation } from '@tanstack/react-query';
import { callFunction } from '@shared/lib/api';
import { supabase } from '@shared/lib/supabase';
import { blobToWav, pickRecorderMime } from '@shared/lib/audio-wav';
import { fetchSessionNoteContent, useAudioJobWatcher } from '@features/audio-recorder/useAudioJobWatcher';

type RecorderState = 'idle' | 'recording' | 'uploading' | 'processing' | 'review' | 'error';

interface SoapContent {
  subjective: string;
  objective: string;
  assessment: string;
  plan: string;
}

interface StudioRecorderProps {
  patientId: string;
  patientName: string;
  /** Habilita a etapa de revisão SOAP (desktop). No mobile fica desligado. */
  enableReview?: boolean;
  /** Chamado quando o relatório é salvo/aprovado, para atualizar a fila. */
  onSaved?: () => void;
}

const SOAP_SECTIONS: Array<{ key: keyof SoapContent; label: string }> = [
  { key: 'subjective', label: 'Subjetivo' },
  { key: 'objective', label: 'Objetivo' },
  { key: 'assessment', label: 'Avaliação' },
  { key: 'plan', label: 'Plano' },
];

function formatTime(seconds: number): string {
  const mins = Math.floor(seconds / 60);
  const secs = seconds % 60;
  return `${mins.toString().padStart(2, '0')}:${secs.toString().padStart(2, '0')}`;
}

export function StudioRecorder({ patientId, patientName, enableReview = true, onSaved }: StudioRecorderProps) {
  const [state, setState] = useState<RecorderState>('idle');
  const [duration, setDuration] = useState(0);
  const [error, setError] = useState<string | null>(null);
  const [permissionDenied, setPermissionDenied] = useState(false);
  const [soap, setSoap] = useState<SoapContent | null>(null);
  const [noteId, setNoteId] = useState<string | null>(null);

  const mediaRecorderRef = useRef<MediaRecorder | null>(null);
  const chunksRef = useRef<Blob[]>([]);
  const timerRef = useRef<number | null>(null);
  const streamRef = useRef<MediaStream | null>(null);
  const jobIdRef = useRef<string | null>(null);
  const [processingJobId, setProcessingJobId] = useState<string | null>(null);

  // Reset ao trocar de paciente
  useEffect(() => {
    setState('idle');
    setDuration(0);
    setError(null);
    setSoap(null);
    setNoteId(null);
    jobIdRef.current = null;
    setProcessingJobId(null);
  }, [patientId]);

  // Cleanup
  useEffect(() => {
    return () => {
      if (timerRef.current) clearInterval(timerRef.current);
      if (streamRef.current) streamRef.current.getTracks().forEach((t) => t.stop());
    };
  }, []);

  const handleJobCompleted = useCallback(
    async (sessionNoteId: string) => {
      const content = await fetchSessionNoteContent(sessionNoteId);
      if (content) {
        setNoteId(sessionNoteId);
        setSoap(content as unknown as SoapContent);
      }
      setState(enableReview ? 'review' : 'idle');
      if (!enableReview) onSaved?.();
    },
    [enableReview, onSaved],
  );

  const handleJobFailed = useCallback((reason?: 'failed' | 'timeout') => {
    setError(
      reason === 'timeout'
        ? 'O processamento está demorando mais que o esperado. Verifique os relatórios pendentes ou tente novamente.'
        : 'A IA não conseguiu processar o áudio. Tente novamente.',
    );
    setState('error');
  }, []);

  useAudioJobWatcher({
    active: state === 'processing',
    jobId: processingJobId,
    onCompleted: handleJobCompleted,
    onFailed: handleJobFailed,
  });

  const startRecording = useCallback(async () => {
    try {
      setError(null);
      setPermissionDenied(false);
      const stream = await navigator.mediaDevices.getUserMedia({ audio: true });
      streamRef.current = stream;

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
      setError('Precisamos de acesso ao microfone para gravar a evolução.');
      setState('error');
    }
  }, []);

  const uploadMutation = useMutation({
    mutationFn: async (audioBlob: Blob) => {
      const response = await callFunction<{ audio_recording_id: string; upload_url: string; job_id: string }>(
        'upload-audio',
        { patient_id: patientId, recording_type: 'post_session', duration_seconds: duration },
      );
      const wavBlob = await blobToWav(audioBlob);
      const uploadResponse = await fetch(response.upload_url, {
        method: 'PUT',
        headers: { 'Content-Type': 'audio/wav' },
        body: wavBlob,
      });
      if (!uploadResponse.ok) throw new Error('Falha ao enviar o áudio.');

      // Fire-and-forget: trigger processing pipeline (Realtime will notify when done)
      callFunction('process-audio', {
        audio_recording_id: response.audio_recording_id,
        patient_id: patientId,
        job_id: response.job_id,
      }).catch((err) => console.error('process-audio trigger failed:', err));

      return response;
    },
    onSuccess: (data) => {
      jobIdRef.current = data.job_id;
      setProcessingJobId(data.job_id);
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
      setState('uploading');
      const recordedType = mediaRecorderRef.current?.mimeType || 'audio/webm';
      setTimeout(() => {
        const blob = new Blob(chunksRef.current, { type: recordedType });
        uploadMutation.mutate(blob);
      }, 200);
    }
  }, [state, uploadMutation]);

  const saveMutation = useMutation({
    mutationFn: async ({ approve }: { approve: boolean }) => {
      if (!noteId || !soap) return;
      const userId = (await supabase.auth.getUser()).data.user?.id;
      const update: Record<string, unknown> = { content: soap, updated_at: new Date().toISOString() };
      if (approve) {
        update.status = 'approved';
        update.approved_at = new Date().toISOString();
        update.approved_by = userId;
      }
      const { error: updErr } = await supabase.from('session_notes').update(update).eq('id', noteId);
      if (updErr) throw new Error(updErr.message);
    },
    onSuccess: () => {
      onSaved?.();
      setState('idle');
      setSoap(null);
      setNoteId(null);
      setDuration(0);
    },
    onError: (err: Error) => setError(err.message),
  });

  return (
    <div className="flex flex-1 flex-col">
      {/* Permissão de microfone negada (alerta glassmorphic) */}
      {permissionDenied && (
        <div
          role="alert"
          className="mb-6 rounded-2xl border border-amber-200/70 bg-amber-50/70 p-4 backdrop-blur-sm"
        >
          <p className="text-sm font-medium text-amber-800">Microfone bloqueado</p>
          <p className="mt-1 text-xs text-amber-700">
            Para ditar a evolução, libere o acesso ao microfone no ícone de cadeado da barra de endereço e tente novamente.
          </p>
        </div>
      )}

      {/* ÁREA DE GRAVAÇÃO */}
      {state !== 'review' && (
        <div className="flex flex-col items-center justify-center py-8">
          {/* Timer */}
          {(state === 'recording' || state === 'uploading') && (
            <p
              className="mb-6 font-mono text-4xl font-light tracking-widest text-charcoal"
              aria-live="polite"
            >
              {formatTime(duration)}
            </p>
          )}

          {/* Botão central */}
          {state === 'idle' && (
            <button
              onClick={startRecording}
              className="flex h-20 w-20 items-center justify-center rounded-full bg-blue-600 text-white shadow-xl transition-all duration-300 hover:scale-105 hover:bg-blue-700 active:scale-95"
              aria-label="Iniciar gravação"
            >
              <svg className="h-8 w-8" viewBox="0 0 24 24" fill="currentColor">
                <path d="M12 14c1.66 0 3-1.34 3-3V5c0-1.66-1.34-3-3-3S9 3.34 9 5v6c0 1.66 1.34 3 3 3z" />
                <path d="M17 11c0 2.76-2.24 5-5 5s-5-2.24-5-5H5c0 3.53 2.61 6.43 6 6.92V21h2v-3.08c3.39-.49 6-3.39 6-6.92h-2z" />
              </svg>
            </button>
          )}

          {state === 'recording' && (
            <span className="relative inline-flex">
              <span className="absolute inline-flex h-full w-full animate-ping rounded-full bg-red-400 opacity-20" />
              <button
                onClick={stopRecording}
                className="relative flex h-20 w-20 items-center justify-center rounded-full bg-red-500 text-white shadow-xl transition-transform hover:scale-105 active:scale-95"
                aria-label="Parar gravação"
              >
                <span className="h-6 w-6 rounded-md bg-white" />
              </button>
            </span>
          )}

          {state === 'uploading' && (
            <div className="flex h-20 w-20 items-center justify-center rounded-full bg-slate-100">
              <div className="h-7 w-7 animate-spin rounded-full border-2 border-blue-500 border-t-transparent" />
            </div>
          )}

          {state === 'processing' && (
            <div className="flex flex-col items-center text-center">
              <div className="mb-4 h-10 w-10 animate-spin rounded-full border-[3px] border-indigo-500 border-t-transparent" />
              <p className="bg-gradient-to-r from-blue-600 to-indigo-600 bg-clip-text text-sm font-medium text-transparent">
                A IA está estruturando seu relatório...
              </p>
              <p className="mt-1 text-xs text-charcoal-muted">Isso pode levar alguns instantes.</p>
            </div>
          )}

          {state === 'error' && (
            <div className="flex flex-col items-center text-center">
              <button
                onClick={() => { setState('idle'); setError(null); }}
                className="flex h-20 w-20 items-center justify-center rounded-full bg-slate-100 text-charcoal-muted transition-colors hover:bg-slate-200"
                aria-label="Tentar novamente"
              >
                <svg className="h-7 w-7" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={1.8}>
                  <path strokeLinecap="round" strokeLinejoin="round" d="M4 4v5h5M20 20v-5h-5M5 19a9 9 0 0014-6M19 5a9 9 0 00-14 6" />
                </svg>
              </button>
            </div>
          )}

          {/* Texto de apoio */}
          <p className="mt-5 text-sm text-charcoal-muted">
            {state === 'idle' && 'Clique para ditar a evolução'}
            {state === 'recording' && 'Gravando... clique para finalizar'}
            {state === 'uploading' && 'Enviando áudio com segurança...'}
            {state === 'error' && (error ?? 'Algo deu errado. Tente novamente.')}
          </p>
        </div>
      )}

      {/* ESQUELETO SOAP (placeholder) */}
      {(state === 'idle' || state === 'processing' || state === 'uploading') && (
        <div className="mt-2 space-y-3 border-t border-slate-100 pt-6">
          {SOAP_SECTIONS.map((s) => (
            <div key={s.key}>
              <p className="text-xs font-semibold uppercase tracking-wider text-slate-300">{s.label}</p>
              <p className="mt-1 text-sm text-slate-300">O texto gerado aparecerá aqui...</p>
            </div>
          ))}
        </div>
      )}

      {/* REVISÃO SOAP (editável) */}
      {state === 'review' && soap && (
        <div className="space-y-4">
          <div className="rounded-xl border border-emerald-100 bg-emerald-50/60 px-4 py-3">
            <p className="text-sm font-medium text-emerald-800">Relatório gerado pela IA</p>
            <p className="mt-0.5 text-xs text-emerald-700">
              Revise e ajuste o texto de {patientName} antes de aprovar.
            </p>
          </div>

          {SOAP_SECTIONS.map((s) => (
            <div key={s.key}>
              <label className="text-xs font-semibold uppercase tracking-wider text-slate-500">{s.label}</label>
              <textarea
                value={soap[s.key]}
                onChange={(e) => setSoap((prev) => (prev ? { ...prev, [s.key]: e.target.value } : prev))}
                rows={3}
                className="mt-1.5 w-full resize-y rounded-xl border border-slate-200 bg-white px-3.5 py-2.5 text-sm text-charcoal outline-none transition-colors focus:border-blue-400 focus:ring-2 focus:ring-blue-100"
              />
            </div>
          ))}

          {error && <p className="text-sm text-error">{error}</p>}

          <div className="flex flex-col-reverse gap-3 border-t border-slate-100 pt-4 md:flex-row md:justify-end">
            <button
              onClick={() => saveMutation.mutate({ approve: false })}
              disabled={saveMutation.isPending}
              className="rounded-xl border border-slate-200 px-4 py-2.5 text-sm font-medium text-charcoal transition-colors hover:bg-slate-50 disabled:opacity-50"
            >
              Salvar rascunho
            </button>
            <button
              onClick={() => saveMutation.mutate({ approve: true })}
              disabled={saveMutation.isPending}
              className="rounded-xl bg-blue-600 px-5 py-2.5 text-sm font-medium text-white shadow-sm transition-all hover:bg-blue-700 active:scale-[0.98] disabled:opacity-50"
            >
              {saveMutation.isPending ? 'Salvando...' : 'Aprovar evolução'}
            </button>
          </div>
        </div>
      )}
    </div>
  );
}
