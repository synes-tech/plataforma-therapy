-- Anual arredondado da landing: 207 / 377 / 577 por mês (12x).

UPDATE public.planos
SET preco_anual_mensal_cents = 20700, updated_at = now()
WHERE id = 'standard';

UPDATE public.planos
SET preco_anual_mensal_cents = 37700, updated_at = now()
WHERE id = 'advanced';

UPDATE public.planos
SET preco_anual_mensal_cents = 57700, updated_at = now()
WHERE id = 'premium';
