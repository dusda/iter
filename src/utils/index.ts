const STAFF_APP_ROLES = ["reviewer", "approver", "advisor", "fund_manager", "admin", "super_admin"] as const;

/** Normalize DB text/JSON/csv shapes into a string array (e.g. routing_rule.applicable_categories). */
export function normalizeStringArray(value: unknown): string[] {
  if (Array.isArray(value)) return value.filter((v): v is string => typeof v === "string" && v.trim().length > 0);
  if (typeof value === "string") {
    const trimmed = value.trim();
    if (!trimmed) return [];
    if (trimmed.startsWith("[") && trimmed.endsWith("]")) {
      try {
        const parsed = JSON.parse(trimmed);
        return Array.isArray(parsed)
          ? parsed.filter((v): v is string => typeof v === "string" && v.trim().length > 0)
          : [];
      } catch {
        // fall through to CSV split
      }
    }
    return trimmed
      .split(",")
      .map((s) => s.trim())
      .filter(Boolean);
  }
  return [];
}

/** True when the app treats this role as staff (sidebar + dashboard at `/`). */
export function isStaffAppRole(role: string | undefined | null): boolean {
  return !!role && (STAFF_APP_ROLES as readonly string[]).includes(role);
}

export function createPageUrl(pageName: string) {
    if (pageName === "Home" || pageName === "MyRequests") return "/";
    return '/' + pageName.replace(/ /g, '-');
}