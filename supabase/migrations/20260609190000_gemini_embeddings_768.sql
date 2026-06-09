-- ============================================================
-- Migração para Google Gemini — embeddings 768d
-- Agentes: DBA + IA Generativa
--
-- gemini-embedding-001 com outputDimensionality=768 (normalizado L2).
-- patient_embeddings está vazia (0 linhas) → ALTER direto é seguro,
-- sem necessidade de backfill.
-- ============================================================

-- 1. Recriar coluna/índice na nova dimensão -----------------------------------
DROP INDEX IF EXISTS public.idx_embeddings_vector;

ALTER TABLE public.patient_embeddings
  ALTER COLUMN embedding TYPE vector(768);

CREATE INDEX idx_embeddings_vector ON public.patient_embeddings
  USING hnsw (embedding vector_cosine_ops)
  WITH (m = 16, ef_construction = 64);

-- 2. RPC de busca semântica na nova dimensão ----------------------------------
CREATE OR REPLACE FUNCTION public.search_patient_embeddings(
  p_patient_id UUID,
  p_query_embedding vector(768),
  p_match_count INT DEFAULT 5,
  p_match_threshold FLOAT DEFAULT 0.5,
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
  -- CRÍTICO: isolamento por paciente
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
  FROM public.patient_embeddings pe
  WHERE pe.patient_id = p_patient_id
    AND (1 - (pe.embedding <=> p_query_embedding)) > p_match_threshold
    AND (p_document_type IS NULL OR pe.document_type = p_document_type)
    AND (p_since IS NULL OR pe.created_at >= p_since::timestamptz)
  ORDER BY pe.embedding <=> p_query_embedding
  LIMIT p_match_count;
END;
$$;

COMMENT ON COLUMN public.patient_embeddings.embedding IS 'gemini-embedding-001 (768d, normalizado L2)';
