import { useEffect, useRef } from 'react';
import { supabase } from '@shared/lib/supabase';

interface JobOutputData {
  session_note_id?: string;
}

function parseJobOutput(raw: unknown): JobOutputData | null {
  if (!raw) return null;
  if (typeof raw === 'string') {
    try {
      return JSON.parse(raw) as JobOutputData;
    } catch {
      return null;
    }
  }
  if (typeof raw === 'object') {
    return raw as JobOutputData;
  }
  return null;
}

interface UseAudioJobWatcherOptions {
  active: boolean;
  jobId: string | null;
  onCompleted: (sessionNoteId: string) => void | Promise<void>;
  onFailed: (reason?: 'failed' | 'timeout') => void;
  pollIntervalMs?: number;
  timeoutMs?: number;
}

/**
 * Aguarda conclusão de ai_jobs (process-audio) via polling contínuo + Realtime.
 */
export function useAudioJobWatcher({
  active,
  jobId,
  onCompleted,
  onFailed,
  pollIntervalMs = 3000,
  timeoutMs = 300_000,
}: UseAudioJobWatcherOptions) {
  const settledRef = useRef(false);

  useEffect(() => {
    if (!active || !jobId) return;

    settledRef.current = false;

    async function settleCompleted(sessionNoteId: string) {
      if (settledRef.current) return;
      settledRef.current = true;
      await onCompleted(sessionNoteId);
    }

    function settleFailed(reason: 'failed' | 'timeout' = 'failed') {
      if (settledRef.current) return;
      settledRef.current = true;
      onFailed(reason);
    }

    async function checkJobStatus() {
      if (settledRef.current || !jobId) return;

      const { data, error } = await supabase
        .from('ai_jobs')
        .select('id, status, output_data')
        .eq('id', jobId)
        .single();

      if (error || !data) return;

      const output = parseJobOutput(data.output_data);

      if (data.status === 'completed' && output?.session_note_id) {
        await settleCompleted(output.session_note_id);
        return;
      }

      if (data.status === 'failed') {
        settleFailed('failed');
      }
    }

    void checkJobStatus();

    const pollId = window.setInterval(() => {
      void checkJobStatus();
    }, pollIntervalMs);

    const timeoutId = window.setTimeout(() => {
      if (!settledRef.current) {
        settleFailed('timeout');
      }
    }, timeoutMs);

    const channel = supabase
      .channel(`audio-job-${jobId}`)
      .on(
        'postgres_changes',
        { event: 'UPDATE', schema: 'public', table: 'ai_jobs', filter: `id=eq.${jobId}` },
        (payload) => {
          const job = payload.new as { status: string; output_data?: unknown };
          const output = parseJobOutput(job.output_data);

          if (job.status === 'completed' && output?.session_note_id) {
            void settleCompleted(output.session_note_id);
            return;
          }

          if (job.status === 'failed') {
            settleFailed('failed');
          }
        },
      )
      .subscribe();

    return () => {
      clearInterval(pollId);
      clearTimeout(timeoutId);
      void supabase.removeChannel(channel);
    };
  }, [active, jobId, onCompleted, onFailed, pollIntervalMs, timeoutMs]);
}

export async function fetchSessionNoteContent(
  sessionNoteId: string,
  maxAttempts = 6,
): Promise<Record<string, unknown> | null> {
  for (let attempt = 0; attempt < maxAttempts; attempt += 1) {
    const { data } = await supabase
      .from('session_notes')
      .select('id, content')
      .eq('id', sessionNoteId)
      .single();

    if (data?.content) {
      return data.content as Record<string, unknown>;
    }

    await new Promise((resolve) => window.setTimeout(resolve, 1000 * (attempt + 1)));
  }

  return null;
}
