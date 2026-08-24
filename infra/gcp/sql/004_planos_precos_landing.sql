-- Catálogo alinhado à landing: Standard 237 / Advanced 427 / Premium 657.

UPDATE public.planos
SET
  preco_mensal_cents = 23700,
  preco_anual_mensal_cents = 20700,
  updated_at = now()
WHERE id = 'standard';

UPDATE public.planos
SET
  preco_mensal_cents = 42700,
  preco_anual_mensal_cents = 37700,
  updated_at = now()
WHERE id = 'advanced';

UPDATE public.planos
SET
  preco_mensal_cents = 65700,
  preco_anual_mensal_cents = 57700,
  updated_at = now()
WHERE id = 'premium';
