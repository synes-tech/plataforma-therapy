import type { PlanId } from '@features/register/constants';

export interface PlanoCatalogItem {
  id: PlanId;
  nome: string;
  tipo_perfil: 'autonomo' | 'clinica';
  preco_mensal_cents: number;
  limite_profissionais: number | null;
  limite_pacientes_por_prof: number | null;
  descricao_curta: string | null;
  destaque: string | null;
  features: string[];
  recomendado: boolean;
  sort_order: number;
}

export function formatPlanoPrice(cents: number): string {
  if (cents <= 0) return 'Sob consulta';
  return new Intl.NumberFormat('pt-BR', {
    style: 'currency',
    currency: 'BRL',
    minimumFractionDigits: 2,
  }).format(cents / 100);
}

export function formatPlanoPriceLabel(cents: number): string {
  if (cents <= 0) return 'Preço personalizado';
  return `${formatPlanoPrice(cents)} / mês`;
}
