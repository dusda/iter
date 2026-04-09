const STAFF_APP_ROLES = ["reviewer", "approver", "advisor", "fund_manager", "admin", "super_admin"] as const;

/** True when the app treats this role as staff (sidebar + dashboard at `/`). */
export function isStaffAppRole(role: string | undefined | null): boolean {
  return !!role && (STAFF_APP_ROLES as readonly string[]).includes(role);
}

export function createPageUrl(pageName: string) {
    if (pageName === "Home" || pageName === "MyRequests") return "/";
    return '/' + pageName.replace(/ /g, '-');
}