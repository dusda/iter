import { normalizeStringArray } from "@/utils";

/** Shape of a routing_rule row used when matching a fund request at submit/regenerate time. */
export type RoutingRuleForMatching = {
  step_order: number;
  step_name: string;
  assigned_role?: string | null;
  permissions?: string | null;
  sla_target_days?: number | null;
  min_amount?: number | null;
  max_amount?: number | null;
  applicable_categories?: unknown;
};

/**
 * Active routing rules that apply to this request (amount in cents, category).
 * Matches the Apply submit flow.
 */
export function applicableRoutingRulesForRequest(
  rules: RoutingRuleForMatching[],
  requestedAmountCents: number,
  intendedUseCategory: string
): RoutingRuleForMatching[] {
  return rules.filter((rule) => {
    const amountMatch =
      (!rule.min_amount || requestedAmountCents >= Number(rule.min_amount)) &&
      (!rule.max_amount || requestedAmountCents <= Number(rule.max_amount));
    const ruleCategories = normalizeStringArray(rule.applicable_categories);
    const categoryMatch =
      ruleCategories.length === 0 || ruleCategories.includes(intendedUseCategory);
    return amountMatch && categoryMatch;
  });
}
