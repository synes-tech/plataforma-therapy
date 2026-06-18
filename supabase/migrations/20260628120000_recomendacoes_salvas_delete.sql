-- Permite ao terapeuta remover recomendações salvas da própria carteira
DROP POLICY IF EXISTS "recomendacoes_professional_delete" ON recomendacoes_salvas;
CREATE POLICY "recomendacoes_professional_delete"
  ON recomendacoes_salvas FOR DELETE
  USING (
    terapeuta_id IN (
      SELECT p.id FROM professionals p
      WHERE p.user_id = auth.uid() AND p.deleted_at IS NULL
    )
  );

GRANT DELETE ON recomendacoes_salvas TO authenticated;
