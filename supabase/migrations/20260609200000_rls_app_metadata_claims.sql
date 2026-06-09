-- Corrige RLS: claims devem vir de app_metadata (Supabase nao expoe role/clinic_id
-- como claims top-level; 'role' top-level e reservado para o Postgres role).
-- Gerado automaticamente por scripts/fix-rls-app-metadata.mjs.
BEGIN;

DROP POLICY IF EXISTS "agreements_master_access" ON public."agreements";
CREATE POLICY "agreements_master_access" ON public."agreements"
  AS PERMISSIVE FOR ALL TO authenticated
  USING (((auth.jwt() -> 'app_metadata' ->> 'role'::text) = 'master'::text));

DROP POLICY IF EXISTS "ai_jobs_master_access" ON public."ai_jobs";
CREATE POLICY "ai_jobs_master_access" ON public."ai_jobs"
  AS PERMISSIVE FOR ALL TO public
  USING (((auth.jwt() -> 'app_metadata' ->> 'role'::text) = 'master'::text));

DROP POLICY IF EXISTS "audio_recordings_master_access" ON public."audio_recordings";
CREATE POLICY "audio_recordings_master_access" ON public."audio_recordings"
  AS PERMISSIVE FOR ALL TO public
  USING (((auth.jwt() -> 'app_metadata' ->> 'role'::text) = 'master'::text));

DROP POLICY IF EXISTS "transcriptions_master_access" ON public."audio_transcriptions";
CREATE POLICY "transcriptions_master_access" ON public."audio_transcriptions"
  AS PERMISSIVE FOR ALL TO public
  USING (((auth.jwt() -> 'app_metadata' ->> 'role'::text) = 'master'::text));

DROP POLICY IF EXISTS "audit_logs_clinic_admin_read" ON public."audit_logs";
CREATE POLICY "audit_logs_clinic_admin_read" ON public."audit_logs"
  AS PERMISSIVE FOR SELECT TO public
  USING (((clinic_id = ((auth.jwt() -> 'app_metadata' ->> 'clinic_id'::text))::uuid) AND ((auth.jwt() -> 'app_metadata' ->> 'role'::text) = 'clinic_admin'::text)));

DROP POLICY IF EXISTS "audit_logs_master_read" ON public."audit_logs";
CREATE POLICY "audit_logs_master_read" ON public."audit_logs"
  AS PERMISSIVE FOR SELECT TO public
  USING (((auth.jwt() -> 'app_metadata' ->> 'role'::text) = 'master'::text));

DROP POLICY IF EXISTS "clinic_admins_master_access" ON public."clinic_admins";
CREATE POLICY "clinic_admins_master_access" ON public."clinic_admins"
  AS PERMISSIVE FOR ALL TO public
  USING (((auth.jwt() -> 'app_metadata' ->> 'role'::text) = 'master'::text));

DROP POLICY IF EXISTS "clinic_preferences_admin_read" ON public."clinic_preferences";
CREATE POLICY "clinic_preferences_admin_read" ON public."clinic_preferences"
  AS PERMISSIVE FOR SELECT TO public
  USING (((clinic_id = ((auth.jwt() -> 'app_metadata' ->> 'clinic_id'::text))::uuid) AND ((auth.jwt() -> 'app_metadata' ->> 'role'::text) = 'clinic_admin'::text)));

DROP POLICY IF EXISTS "clinic_preferences_admin_update" ON public."clinic_preferences";
CREATE POLICY "clinic_preferences_admin_update" ON public."clinic_preferences"
  AS PERMISSIVE FOR UPDATE TO public
  USING (((clinic_id = ((auth.jwt() -> 'app_metadata' ->> 'clinic_id'::text))::uuid) AND ((auth.jwt() -> 'app_metadata' ->> 'role'::text) = 'clinic_admin'::text)));

DROP POLICY IF EXISTS "clinic_preferences_master_access" ON public."clinic_preferences";
CREATE POLICY "clinic_preferences_master_access" ON public."clinic_preferences"
  AS PERMISSIVE FOR ALL TO public
  USING (((auth.jwt() -> 'app_metadata' ->> 'role'::text) = 'master'::text));

DROP POLICY IF EXISTS "clinic_settings_admin_view" ON public."clinic_settings";
CREATE POLICY "clinic_settings_admin_view" ON public."clinic_settings"
  AS PERMISSIVE FOR SELECT TO public
  USING ((clinic_id = ((auth.jwt() -> 'app_metadata' ->> 'clinic_id'::text))::uuid));

DROP POLICY IF EXISTS "clinic_settings_master_access" ON public."clinic_settings";
CREATE POLICY "clinic_settings_master_access" ON public."clinic_settings"
  AS PERMISSIVE FOR ALL TO public
  USING (((auth.jwt() -> 'app_metadata' ->> 'role'::text) = 'master'::text));

DROP POLICY IF EXISTS "clinics_admin_view_own" ON public."clinics";
CREATE POLICY "clinics_admin_view_own" ON public."clinics"
  AS PERMISSIVE FOR SELECT TO public
  USING (((id = ((auth.jwt() -> 'app_metadata' ->> 'clinic_id'::text))::uuid) AND (deleted_at IS NULL)));

DROP POLICY IF EXISTS "clinics_master_full_access" ON public."clinics";
CREATE POLICY "clinics_master_full_access" ON public."clinics"
  AS PERMISSIVE FOR ALL TO public
  USING (((auth.jwt() -> 'app_metadata' ->> 'role'::text) = 'master'::text));

DROP POLICY IF EXISTS "clinics_professional_view_own" ON public."clinics";
CREATE POLICY "clinics_professional_view_own" ON public."clinics"
  AS PERMISSIVE FOR SELECT TO public
  USING (((id = ((auth.jwt() -> 'app_metadata' ->> 'clinic_id'::text))::uuid) AND (deleted_at IS NULL)));

DROP POLICY IF EXISTS "crisis_alerts_master_access" ON public."crisis_alerts";
CREATE POLICY "crisis_alerts_master_access" ON public."crisis_alerts"
  AS PERMISSIVE FOR ALL TO public
  USING (((auth.jwt() -> 'app_metadata' ->> 'role'::text) = 'master'::text));

DROP POLICY IF EXISTS "diary_entries_clinic_admin_view" ON public."diary_entries";
CREATE POLICY "diary_entries_clinic_admin_view" ON public."diary_entries"
  AS PERMISSIVE FOR SELECT TO public
  USING (((clinic_id = ((auth.jwt() -> 'app_metadata' ->> 'clinic_id'::text))::uuid) AND ((auth.jwt() -> 'app_metadata' ->> 'role'::text) = 'clinic_admin'::text) AND (deleted_at IS NULL)));

DROP POLICY IF EXISTS "diary_entries_master_access" ON public."diary_entries";
CREATE POLICY "diary_entries_master_access" ON public."diary_entries"
  AS PERMISSIVE FOR ALL TO public
  USING (((auth.jwt() -> 'app_metadata' ->> 'role'::text) = 'master'::text));

DROP POLICY IF EXISTS "family_members_clinic_admin_access" ON public."family_members";
CREATE POLICY "family_members_clinic_admin_access" ON public."family_members"
  AS PERMISSIVE FOR ALL TO public
  USING (((clinic_id = ((auth.jwt() -> 'app_metadata' ->> 'clinic_id'::text))::uuid) AND ((auth.jwt() -> 'app_metadata' ->> 'role'::text) = 'clinic_admin'::text)));

DROP POLICY IF EXISTS "family_members_master_access" ON public."family_members";
CREATE POLICY "family_members_master_access" ON public."family_members"
  AS PERMISSIVE FOR ALL TO public
  USING (((auth.jwt() -> 'app_metadata' ->> 'role'::text) = 'master'::text));

DROP POLICY IF EXISTS "family_members_professional_view" ON public."family_members";
CREATE POLICY "family_members_professional_view" ON public."family_members"
  AS PERMISSIVE FOR SELECT TO public
  USING (((clinic_id = ((auth.jwt() -> 'app_metadata' ->> 'clinic_id'::text))::uuid) AND ((auth.jwt() -> 'app_metadata' ->> 'role'::text) = 'professional'::text) AND (deleted_at IS NULL)));

DROP POLICY IF EXISTS "invites_clinic_admin_access" ON public."invites";
CREATE POLICY "invites_clinic_admin_access" ON public."invites"
  AS PERMISSIVE FOR ALL TO public
  USING (((clinic_id = ((auth.jwt() -> 'app_metadata' ->> 'clinic_id'::text))::uuid) AND ((auth.jwt() -> 'app_metadata' ->> 'role'::text) = 'clinic_admin'::text)));

DROP POLICY IF EXISTS "invites_master_access" ON public."invites";
CREATE POLICY "invites_master_access" ON public."invites"
  AS PERMISSIVE FOR ALL TO public
  USING (((auth.jwt() -> 'app_metadata' ->> 'role'::text) = 'master'::text));

DROP POLICY IF EXISTS "invites_professional_own" ON public."invites";
CREATE POLICY "invites_professional_own" ON public."invites"
  AS PERMISSIVE FOR ALL TO public
  USING (((clinic_id = ((auth.jwt() -> 'app_metadata' ->> 'clinic_id'::text))::uuid) AND (professional_id IN ( SELECT p.id
   FROM professionals p
  WHERE ((p.user_id = auth.uid()) AND (p.deleted_at IS NULL))))));

DROP POLICY IF EXISTS "invoices_clinic_admin_read" ON public."invoices";
CREATE POLICY "invoices_clinic_admin_read" ON public."invoices"
  AS PERMISSIVE FOR SELECT TO public
  USING (((clinic_id = ((auth.jwt() -> 'app_metadata' ->> 'clinic_id'::text))::uuid) AND ((auth.jwt() -> 'app_metadata' ->> 'role'::text) = 'clinic_admin'::text) AND (deleted_at IS NULL)));

DROP POLICY IF EXISTS "invoices_master_access" ON public."invoices";
CREATE POLICY "invoices_master_access" ON public."invoices"
  AS PERMISSIVE FOR ALL TO public
  USING (((auth.jwt() -> 'app_metadata' ->> 'role'::text) = 'master'::text));

DROP POLICY IF EXISTS "embeddings_master_access" ON public."patient_embeddings";
CREATE POLICY "embeddings_master_access" ON public."patient_embeddings"
  AS PERMISSIVE FOR ALL TO public
  USING (((auth.jwt() -> 'app_metadata' ->> 'role'::text) = 'master'::text));

DROP POLICY IF EXISTS "patient_family_links_master_access" ON public."patient_family_links";
CREATE POLICY "patient_family_links_master_access" ON public."patient_family_links"
  AS PERMISSIVE FOR ALL TO public
  USING (((auth.jwt() -> 'app_metadata' ->> 'role'::text) = 'master'::text));

DROP POLICY IF EXISTS "patient_family_links_professional" ON public."patient_family_links";
CREATE POLICY "patient_family_links_professional" ON public."patient_family_links"
  AS PERMISSIVE FOR ALL TO public
  USING (((clinic_id = ((auth.jwt() -> 'app_metadata' ->> 'clinic_id'::text))::uuid) AND (patient_id IN ( SELECT pat.id
   FROM (patients pat
     JOIN professionals prof ON ((pat.professional_id = prof.id)))
  WHERE ((prof.user_id = auth.uid()) AND (prof.deleted_at IS NULL) AND (pat.deleted_at IS NULL))))));

DROP POLICY IF EXISTS "patients_clinic_admin_access" ON public."patients";
CREATE POLICY "patients_clinic_admin_access" ON public."patients"
  AS PERMISSIVE FOR SELECT TO public
  USING (((clinic_id = ((auth.jwt() -> 'app_metadata' ->> 'clinic_id'::text))::uuid) AND ((auth.jwt() -> 'app_metadata' ->> 'role'::text) = 'clinic_admin'::text) AND (deleted_at IS NULL)));

DROP POLICY IF EXISTS "patients_master_access" ON public."patients";
CREATE POLICY "patients_master_access" ON public."patients"
  AS PERMISSIVE FOR ALL TO public
  USING (((auth.jwt() -> 'app_metadata' ->> 'role'::text) = 'master'::text));

DROP POLICY IF EXISTS "patients_professional_own" ON public."patients";
CREATE POLICY "patients_professional_own" ON public."patients"
  AS PERMISSIVE FOR ALL TO public
  USING (((clinic_id = ((auth.jwt() -> 'app_metadata' ->> 'clinic_id'::text))::uuid) AND (professional_id IN ( SELECT p.id
   FROM professionals p
  WHERE ((p.user_id = auth.uid()) AND (p.deleted_at IS NULL)))) AND (deleted_at IS NULL)));

DROP POLICY IF EXISTS "platform_admins_master_access" ON public."platform_admins";
CREATE POLICY "platform_admins_master_access" ON public."platform_admins"
  AS PERMISSIVE FOR ALL TO public
  USING (((auth.jwt() -> 'app_metadata' ->> 'role'::text) = 'master'::text));

DROP POLICY IF EXISTS "professionals_clinic_admin_access" ON public."professionals";
CREATE POLICY "professionals_clinic_admin_access" ON public."professionals"
  AS PERMISSIVE FOR ALL TO public
  USING (((clinic_id = ((auth.jwt() -> 'app_metadata' ->> 'clinic_id'::text))::uuid) AND ((auth.jwt() -> 'app_metadata' ->> 'role'::text) = 'clinic_admin'::text) AND (deleted_at IS NULL)));

DROP POLICY IF EXISTS "professionals_master_access" ON public."professionals";
CREATE POLICY "professionals_master_access" ON public."professionals"
  AS PERMISSIVE FOR ALL TO public
  USING (((auth.jwt() -> 'app_metadata' ->> 'role'::text) = 'master'::text));

DROP POLICY IF EXISTS "professionals_view_own_clinic" ON public."professionals";
CREATE POLICY "professionals_view_own_clinic" ON public."professionals"
  AS PERMISSIVE FOR SELECT TO public
  USING (((clinic_id = ((auth.jwt() -> 'app_metadata' ->> 'clinic_id'::text))::uuid) AND (deleted_at IS NULL)));

DROP POLICY IF EXISTS "session_notes_master_access" ON public."session_notes";
CREATE POLICY "session_notes_master_access" ON public."session_notes"
  AS PERMISSIVE FOR ALL TO public
  USING (((auth.jwt() -> 'app_metadata' ->> 'role'::text) = 'master'::text));

DROP POLICY IF EXISTS "schedule_master_access" ON public."therapist_schedule";
CREATE POLICY "schedule_master_access" ON public."therapist_schedule"
  AS PERMISSIVE FOR ALL TO public
  USING (((auth.jwt() -> 'app_metadata' ->> 'role'::text) = 'master'::text));

COMMIT;
