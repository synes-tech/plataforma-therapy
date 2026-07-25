-- Resumo clínico gerado por IA para anexos da base de conhecimento
ALTER TABLE public.patient_attachments
  ADD COLUMN IF NOT EXISTS ai_summary TEXT;

COMMENT ON COLUMN public.patient_attachments.ai_summary IS
  'Resumo em linguagem natural gerado pela IA a partir do texto extraído do anexo.';
