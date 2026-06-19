-- Inbox Zero: soft dismiss de alertas do dashboard (diary_entries) por profissional
CREATE TABLE IF NOT EXISTS professional_dashboard_dismissals (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  professional_id UUID NOT NULL REFERENCES professionals(id) ON DELETE CASCADE,
  diary_entry_id UUID NOT NULL REFERENCES diary_entries(id) ON DELETE CASCADE,
  dismissed_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  CONSTRAINT professional_dashboard_dismissals_unique UNIQUE (professional_id, diary_entry_id)
);

CREATE INDEX IF NOT EXISTS idx_dashboard_dismissals_professional
  ON professional_dashboard_dismissals (professional_id, dismissed_at DESC);

ALTER TABLE professional_dashboard_dismissals ENABLE ROW LEVEL SECURITY;

CREATE POLICY "dashboard_dismissals_master_access"
  ON professional_dashboard_dismissals FOR ALL
  USING ((auth.jwt() ->> 'role') = 'master');

CREATE POLICY "dashboard_dismissals_professional_own"
  ON professional_dashboard_dismissals FOR ALL
  USING (
    professional_id IN (
      SELECT p.id FROM professionals p
      WHERE p.user_id = auth.uid() AND p.deleted_at IS NULL
    )
  );
