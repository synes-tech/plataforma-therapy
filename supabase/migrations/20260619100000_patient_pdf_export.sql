-- ============================================================
-- Motor de Impressão — dados consolidados para PDF
-- Telefone do terapeuta (opcional) + fallback clínica
-- ============================================================

ALTER TABLE public.professionals
  ADD COLUMN IF NOT EXISTS phone TEXT;

COMMENT ON COLUMN public.professionals.phone IS 'Telefone de contato do profissional (exibido em PDFs e laudos).';

CREATE OR REPLACE FUNCTION public.get_patient_pdf_export_data(p_patient_id UUID)
RETURNS JSONB
LANGUAGE plpgsql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_row RECORD;
BEGIN
  SELECT
    p.id AS patient_id,
    p.name AS patient_name,
    p.birth_date,
    p.gender,
    p.diagnoses,
    p.clinical_observations,
    p.professional_id,
    p.clinic_id,
    prof.name AS professional_name,
    prof.email AS professional_email,
    prof.specialty AS professional_specialty,
    prof.crp AS professional_crp,
    COALESCE(NULLIF(trim(prof.phone), ''), NULLIF(trim(c.phone), '')) AS professional_phone,
    c.name AS clinic_name,
    ps.summary_markdown AS clinical_summary,
    ps.updated_at AS summary_updated_at
  INTO v_row
  FROM patients p
  INNER JOIN professionals prof ON prof.id = p.professional_id AND prof.deleted_at IS NULL
  INNER JOIN clinics c ON c.id = p.clinic_id AND c.deleted_at IS NULL
  LEFT JOIN patient_proactive_summaries ps ON ps.patient_id = p.id
  WHERE p.id = p_patient_id AND p.deleted_at IS NULL;

  IF NOT FOUND THEN
    RETURN jsonb_build_object('found', false);
  END IF;

  RETURN jsonb_build_object(
    'found', true,
    'generated_at', now(),
    'professional', jsonb_build_object(
      'name', v_row.professional_name,
      'email', v_row.professional_email,
      'phone', v_row.professional_phone,
      'specialty', v_row.professional_specialty,
      'crp', v_row.professional_crp
    ),
    'clinic', jsonb_build_object('name', v_row.clinic_name),
    'patient', jsonb_build_object(
      'id', v_row.patient_id,
      'name', v_row.patient_name,
      'birth_date', v_row.birth_date,
      'gender', v_row.gender,
      'diagnoses', v_row.diagnoses,
      'clinical_observations', v_row.clinical_observations
    ),
    'clinical_summary', CASE
      WHEN v_row.clinical_summary IS NOT NULL AND trim(v_row.clinical_summary) <> '' THEN
        jsonb_build_object(
          'markdown', v_row.clinical_summary,
          'updated_at', v_row.summary_updated_at
        )
      ELSE NULL
    END
  );
END;
$$;

REVOKE ALL ON FUNCTION public.get_patient_pdf_export_data(UUID) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.get_patient_pdf_export_data(UUID) TO service_role;

COMMENT ON FUNCTION public.get_patient_pdf_export_data IS
  'Consolida terapeuta, paciente e último resumo proativo para exportação PDF. Somente service_role.';
