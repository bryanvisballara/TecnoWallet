export type AssistantPeriod =
  | 'this_month'
  | 'last_month'
  | 'this_year'
  | 'last_30_days';

export type AssistantIntentKind =
  | 'category_spend'
  | 'top_categories'
  | 'month_totals'
  | 'account_balances'
  | 'goals'
  | 'general';

export type AssistantIntent = {
  intent: AssistantIntentKind;
  period: AssistantPeriod;
  categoryHint?: string;
  complexity: 'simple' | 'complex';
};
