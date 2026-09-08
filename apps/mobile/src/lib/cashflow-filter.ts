import type { Transaction } from '@/data/demo';

export function cashflowCategoryName(item: Pick<Transaction, 'category'>) {
  return item.category.trim() || 'Otros';
}

export function matchesCashflowCategory(
  item: Pick<Transaction, 'category'>,
  selected: string | null,
) {
  if (!selected) return true;
  return cashflowCategoryName(item) === selected;
}

export function openCashflowDetalle(params: {
  type: 'gastos' | 'ingresos';
  category?: string;
  needWant?: 'need' | 'want';
}) {
  return {
    pathname: '/(tabs)/cashflow/detalle' as const,
    params: {
      type: params.type,
      ...(params.category ? { category: params.category } : {}),
      ...(params.needWant ? { needWant: params.needWant } : {}),
    },
  };
}
