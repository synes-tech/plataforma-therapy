-- ============================================================
-- Fase 5 — Incremento atômico de licenças de backup (add-on)
-- Evita race condition em cliques rápidos no bypass de compra
-- ============================================================

CREATE OR REPLACE FUNCTION public.increment_backup_licenses(
  p_clinic_id uuid,
  p_amount integer
)
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_new_total integer;
BEGIN
  IF p_amount IS NULL OR p_amount <= 0 OR p_amount % 5 <> 0 THEN
    RAISE EXCEPTION 'invalid_amount' USING ERRCODE = '22023';
  END IF;

  UPDATE public.clinics
  SET quantidade_backup_pacientes = quantidade_backup_pacientes + p_amount
  WHERE id = p_clinic_id
    AND deleted_at IS NULL
  RETURNING quantidade_backup_pacientes INTO v_new_total;

  IF NOT FOUND THEN
    RAISE EXCEPTION 'clinic_not_found' USING ERRCODE = 'P0002';
  END IF;

  UPDATE public.clinic_subscriptions
  SET quantidade_backup_pacientes = quantidade_backup_pacientes + p_amount
  WHERE id = (
    SELECT cs.id
    FROM public.clinic_subscriptions cs
    WHERE cs.clinic_id = p_clinic_id
      AND cs.status IN ('trial_active', 'active', 'trialing')
    ORDER BY cs.started_at DESC
    LIMIT 1
  );

  RETURN jsonb_build_object(
    'quantidade_backup_pacientes', v_new_total,
    'increment', p_amount
  );
END;
$$;

COMMENT ON FUNCTION public.increment_backup_licenses(uuid, integer) IS
  'Soma licenças de backup na clínica e na assinatura ativa (operação atômica).';

REVOKE ALL ON FUNCTION public.increment_backup_licenses(uuid, integer) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.increment_backup_licenses(uuid, integer) TO service_role;
