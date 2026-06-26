-- Título customizável para documentos salvos (copiloto / artefatos IA)
ALTER TABLE recomendacoes_salvas
  ADD COLUMN IF NOT EXISTS titulo TEXT;

COMMENT ON COLUMN recomendacoes_salvas.titulo IS
  'Título editável pelo profissional. Quando NULL, o frontend deriva do tipo + data.';
