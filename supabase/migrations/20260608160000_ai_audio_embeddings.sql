-- ============================================================
-- THERAPY.AI — AI Motor: Audio, Transcriptions, Notes & Embeddings
-- Migration: 20260608160000_ai_audio_embeddings.sql
-- Description: Tables for audio pipeline, SOAP notes, and pgvector embeddings
-- ============================================================

-- Enable pgvector extension
CREATE EXTENSION IF NOT EXISTS vector;

-- ============================================================
-- TABLE: audio_recordings (Raw audio files from therapist)
-- ============================================================

CREATE TABLE audio_recordings (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  patient_id UUID NOT NULL REFERENCES patients(id) ON DELETE RESTRICT,
  professional_id UUID NOT NULL REFERENCES professionals(id) ON DELETE RESTRICT,
  clinic_id UUID NOT NULL REFERENCES clinics(id) ON DELETE RESTRICT,
  storage_path TEXT NOT NULL,  -- Supabase Storage path
  duration_seconds INT,
  file_size_bytes BIGINT,
  mime_type TEXT NOT NULL DEFAULT 'audio/webm',
  recording_type TEXT NOT NULL CHECK (recording_type IN ('onboarding', 'post_session', 'note')),
  status TEXT NOT NULL CHECK (status IN ('uploading', 'uploaded', 'processing', 'transcribed', 'failed')) DEFAULT 'uploaded',
  error_message TEXT,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  deleted_at TIMESTAMPTZ DEFAULT NULL
);

CREATE TRIGGER trg_audio_recordings_updated
  BEFORE UPDATE ON audio_recordings
  FOR EACH ROW EXECUTE FUNCTION update_updated_at();

CREATE INDEX idx_audio_recordings_patient ON audio_recordings (patient_id, created_at DESC) WHERE deleted_at IS NULL;
CREATE INDEX idx_audio_recordings_status ON audio_recordings (status) WHERE status IN ('uploaded', 'processing');

ALTER TABLE audio_recordings ENABLE ROW LEVEL SECURITY;

CREATE POLICY "audio_recordings_master_access"
  ON audio_recordings FOR ALL
  USING ((auth.jwt() ->> 'role') = 'master');

CREATE POLICY "audio_recordings_professional_own"
  ON audio_recordings FOR ALL
  USING (
    professional_id IN (
      SELECT p.id FROM professionals p WHERE p.user_id = auth.uid() AND p.deleted_at IS NULL
    )
    AND deleted_at IS NULL
  );

-- ============================================================
-- TABLE: audio_transcriptions (Whisper STT output)
-- ============================================================

CREATE TABLE audio_transcriptions (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  audio_recording_id UUID NOT NULL REFERENCES audio_recordings(id) ON DELETE RESTRICT,
  patient_id UUID NOT NULL REFERENCES patients(id) ON DELETE RESTRICT,
  clinic_id UUID NOT NULL REFERENCES clinics(id) ON DELETE RESTRICT,
  raw_text TEXT NOT NULL,  -- Full transcription from Whisper
  language TEXT NOT NULL DEFAULT 'pt-BR',
  confidence_score FLOAT,
  word_count INT,
  processing_duration_ms INT,  -- How long Whisper took
  model_version TEXT NOT NULL DEFAULT 'whisper-1',
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE INDEX idx_transcriptions_patient ON audio_transcriptions (patient_id, created_at DESC);
CREATE INDEX idx_transcriptions_audio ON audio_transcriptions (audio_recording_id);

ALTER TABLE audio_transcriptions ENABLE ROW LEVEL SECURITY;

CREATE POLICY "transcriptions_master_access"
  ON audio_transcriptions FOR ALL
  USING ((auth.jwt() ->> 'role') = 'master');

CREATE POLICY "transcriptions_professional_view"
  ON audio_transcriptions FOR SELECT
  USING (
    patient_id IN (
      SELECT pat.id FROM patients pat
      JOIN professionals prof ON pat.professional_id = prof.id
      WHERE prof.user_id = auth.uid() AND prof.deleted_at IS NULL AND pat.deleted_at IS NULL
    )
  );

-- ============================================================
-- TABLE: session_notes (Structured SOAP notes — AI generated + human approved)
-- ============================================================

CREATE TABLE session_notes (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  patient_id UUID NOT NULL REFERENCES patients(id) ON DELETE RESTRICT,
  professional_id UUID NOT NULL REFERENCES professionals(id) ON DELETE RESTRICT,
  clinic_id UUID NOT NULL REFERENCES clinics(id) ON DELETE RESTRICT,
  audio_recording_id UUID REFERENCES audio_recordings(id),
  transcription_id UUID REFERENCES audio_transcriptions(id),
  version INT NOT NULL DEFAULT 1,
  status TEXT NOT NULL CHECK (status IN ('draft', 'approved', 'archived')) DEFAULT 'draft',
  -- SOAP structured content
  content JSONB NOT NULL DEFAULT '{}'::jsonb,
  /*
    content structure:
    {
      "subjective": "Patient reports...",
      "objective": "Observed behaviors...",
      "assessment": "Analysis of progress...",
      "plan": "Next steps..."
    }
  */
  ai_generated BOOLEAN NOT NULL DEFAULT true,
  approved_at TIMESTAMPTZ,
  approved_by UUID REFERENCES auth.users(id),
  llm_model TEXT,  -- Which model generated this
  llm_tokens_used INT,
  llm_latency_ms INT,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  deleted_at TIMESTAMPTZ DEFAULT NULL
);

CREATE TRIGGER trg_session_notes_updated
  BEFORE UPDATE ON session_notes
  FOR EACH ROW EXECUTE FUNCTION update_updated_at();

CREATE INDEX idx_session_notes_patient ON session_notes (patient_id, created_at DESC) WHERE deleted_at IS NULL;
CREATE INDEX idx_session_notes_status ON session_notes (patient_id, status) WHERE deleted_at IS NULL;
CREATE INDEX idx_session_notes_professional ON session_notes (professional_id, created_at DESC) WHERE deleted_at IS NULL;

ALTER TABLE session_notes ENABLE ROW LEVEL SECURITY;

CREATE POLICY "session_notes_master_access"
  ON session_notes FOR ALL
  USING ((auth.jwt() ->> 'role') = 'master');

CREATE POLICY "session_notes_professional_own"
  ON session_notes FOR ALL
  USING (
    professional_id IN (
      SELECT p.id FROM professionals p WHERE p.user_id = auth.uid() AND p.deleted_at IS NULL
    )
    AND deleted_at IS NULL
  );

-- ============================================================
-- TABLE: patient_embeddings (pgvector — ISOLATED per patient)
-- This is the RAG knowledge base for the AI copilot
-- ============================================================

CREATE TABLE patient_embeddings (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  patient_id UUID NOT NULL REFERENCES patients(id) ON DELETE RESTRICT,
  clinic_id UUID NOT NULL REFERENCES clinics(id) ON DELETE RESTRICT,
  -- Source document reference
  document_type TEXT NOT NULL CHECK (document_type IN ('session_note', 'transcription', 'diary_entry', 'onboarding')),
  source_id UUID NOT NULL,  -- References the source document (session_notes.id, diary_entries.id, etc.)
  -- Embedding content
  content TEXT NOT NULL,  -- The text chunk that was embedded
  embedding vector(1536) NOT NULL,  -- text-embedding-3-large dimension
  -- Metadata for filtering
  metadata JSONB NOT NULL DEFAULT '{}'::jsonb,
  /*
    metadata: {
      "session_id": "uuid",
      "created_at": "2026-06-08",
      "word_count": 150,
      "section": "assessment"
    }
  */
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

-- HNSW index for fast approximate nearest neighbor search
CREATE INDEX idx_embeddings_vector ON patient_embeddings
  USING hnsw (embedding vector_cosine_ops)
  WITH (m = 16, ef_construction = 64);

-- CRITICAL: Composite index forcing patient_id filter on all vector searches
CREATE INDEX idx_embeddings_patient_type ON patient_embeddings (patient_id, document_type, created_at DESC);

ALTER TABLE patient_embeddings ENABLE ROW LEVEL SECURITY;

-- CRITICAL: Even SELECT requires patient_id scope
CREATE POLICY "embeddings_professional_patient_scope"
  ON patient_embeddings FOR SELECT
  USING (
    patient_id IN (
      SELECT pat.id FROM patients pat
      JOIN professionals prof ON pat.professional_id = prof.id
      WHERE prof.user_id = auth.uid() AND prof.deleted_at IS NULL AND pat.deleted_at IS NULL
    )
  );

CREATE POLICY "embeddings_master_access"
  ON patient_embeddings FOR ALL
  USING ((auth.jwt() ->> 'role') = 'master');

-- ============================================================
-- FUNCTION: Search patient embeddings (MUST have patient_id)
-- This is the only way to query embeddings — enforces isolation
-- ============================================================

CREATE OR REPLACE FUNCTION search_patient_embeddings(
  p_patient_id UUID,
  p_query_embedding vector(1536),
  p_match_count INT DEFAULT 5,
  p_match_threshold FLOAT DEFAULT 0.7,
  p_document_type TEXT DEFAULT NULL,
  p_since DATE DEFAULT NULL
)
RETURNS TABLE (
  id UUID,
  content TEXT,
  document_type TEXT,
  metadata JSONB,
  similarity FLOAT,
  created_at TIMESTAMPTZ
)
LANGUAGE plpgsql STABLE SECURITY DEFINER AS $$
BEGIN
  -- CRITICAL: patient_id MUST NOT be null
  IF p_patient_id IS NULL THEN
    RAISE EXCEPTION 'patient_id is required and cannot be null — isolation violation';
  END IF;

  RETURN QUERY
  SELECT
    pe.id,
    pe.content,
    pe.document_type,
    pe.metadata,
    (1 - (pe.embedding <=> p_query_embedding))::FLOAT AS similarity,
    pe.created_at
  FROM patient_embeddings pe
  WHERE pe.patient_id = p_patient_id
    AND (1 - (pe.embedding <=> p_query_embedding)) > p_match_threshold
    AND (p_document_type IS NULL OR pe.document_type = p_document_type)
    AND (p_since IS NULL OR pe.created_at >= p_since::timestamptz)
  ORDER BY pe.embedding <=> p_query_embedding
  LIMIT p_match_count;
END;
$$;

-- ============================================================
-- TABLE: ai_jobs (Async job queue for AI processing)
-- ============================================================

CREATE TABLE ai_jobs (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  patient_id UUID NOT NULL REFERENCES patients(id) ON DELETE RESTRICT,
  clinic_id UUID NOT NULL REFERENCES clinics(id) ON DELETE RESTRICT,
  professional_id UUID NOT NULL REFERENCES professionals(id) ON DELETE RESTRICT,
  job_type TEXT NOT NULL CHECK (job_type IN ('transcribe', 'structure_soap', 'generate_embeddings', 'copilot_query')),
  status TEXT NOT NULL CHECK (status IN ('pending', 'processing', 'completed', 'failed')) DEFAULT 'pending',
  input_data JSONB NOT NULL DEFAULT '{}'::jsonb,  -- Job-specific input
  output_data JSONB,  -- Result when completed
  error_message TEXT,
  attempts INT NOT NULL DEFAULT 0,
  max_attempts INT NOT NULL DEFAULT 3,
  started_at TIMESTAMPTZ,
  completed_at TIMESTAMPTZ,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE TRIGGER trg_ai_jobs_updated
  BEFORE UPDATE ON ai_jobs
  FOR EACH ROW EXECUTE FUNCTION update_updated_at();

CREATE INDEX idx_ai_jobs_pending ON ai_jobs (status, created_at) WHERE status = 'pending';
CREATE INDEX idx_ai_jobs_patient ON ai_jobs (patient_id, created_at DESC);

ALTER TABLE ai_jobs ENABLE ROW LEVEL SECURITY;

CREATE POLICY "ai_jobs_master_access"
  ON ai_jobs FOR ALL
  USING ((auth.jwt() ->> 'role') = 'master');

CREATE POLICY "ai_jobs_professional_own"
  ON ai_jobs FOR ALL
  USING (
    professional_id IN (
      SELECT p.id FROM professionals p WHERE p.user_id = auth.uid() AND p.deleted_at IS NULL
    )
  );
