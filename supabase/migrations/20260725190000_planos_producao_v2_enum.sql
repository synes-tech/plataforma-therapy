-- ============================================================
-- UNITHERY — Planos de produção v2 (FREE / STANDARD / ADVANCED / PREMIUM)
-- Parte 1/2: valores novos no enum subscription_plan
-- (separado do corpo: valores de enum não podem ser usados na
--  mesma transação em que são criados)
-- Ref: docs/plano-implementacao-planos-producao.md
-- ============================================================

ALTER TYPE subscription_plan ADD VALUE IF NOT EXISTS 'free';
ALTER TYPE subscription_plan ADD VALUE IF NOT EXISTS 'standard';
ALTER TYPE subscription_plan ADD VALUE IF NOT EXISTS 'advanced';
ALTER TYPE subscription_plan ADD VALUE IF NOT EXISTS 'premium';
