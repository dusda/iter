import React, { useState, useEffect, useRef } from "react";
import { Link } from "react-router-dom";
import { createPageUrl } from "@/utils";
import { api } from "@/api/supabaseApi";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import PageHeader from "@/components/shared/PageHeader";
import StatusBadge from "@/components/shared/StatusBadge";
import LoadingSpinner from "@/components/shared/LoadingSpinner";
import EmptyState from "@/components/shared/EmptyState";
import { Card, CardContent } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Badge } from "@/components/ui/badge";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Switch } from "@/components/ui/switch";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import {
  Users as UsersIcon,
  Search,
  Filter,
  MoreHorizontal,
  Edit,
  UserPlus,
  Mail,
  Phone,
  Shield,
  GraduationCap,
  UserCheck,
  Settings as SettingsIcon,
  Check,
  X,
  ClipboardList,
  Building2,
  MessageSquare,
  ChevronLeft,
  ChevronRight,
  Copy,
} from "lucide-react";
import { format } from "date-fns";
import { useMutation } from "@tanstack/react-query";
import { toast } from "@/components/ui/use-toast";

type AppRole = "student" | "reviewer" | "advisor" | "approver" | "fund_manager" | "admin" | "super_admin";

const ACCESS_REQUESTS_PAGE_SIZE = 10;

/** Lowest → highest privilege; used to cap role assignment to the editor’s own level. */
const APP_ROLE_ORDER: AppRole[] = [
  "student",
  "reviewer",
  "advisor",
  "approver",
  "fund_manager",
  "admin",
  "super_admin",
];

function appRoleRank(role: string | null | undefined): number {
  const r = (role || "student") as AppRole;
  const i = APP_ROLE_ORDER.indexOf(r);
  return i >= 0 ? i : 0;
}

function assignableAppRoles(actorRole: string | null | undefined): AppRole[] {
  const max = appRoleRank(actorRole);
  return APP_ROLE_ORDER.slice(0, max + 1);
}

function formatRoleOption(role: AppRole): string {
  return role.replace(/_/g, " ").replace(/\b\w/g, (c) => c.toUpperCase());
}

interface DashboardPermissions {
  view_stats?: boolean;
  view_pending_requests?: boolean;
  view_fund_overview?: boolean;
  access_queue?: boolean;
  access_funds?: boolean;
  access_reports?: boolean;
  access_rules?: boolean;
  access_users?: boolean;
  access_audit_log?: boolean;
  access_settings?: boolean;
  [key: string]: boolean | undefined;
}

interface UserSummary {
  id: string;
  full_name: string | null;
  email: string;
  phone?: string | null;
  app_role: AppRole | null;
  status?: string | null;
  organization_id?: string;
  created_date: string;
  dashboard_permissions?: DashboardPermissions;
  student_id?: string | null;
}

/** True if the actor may change another user’s profile (role, permissions, etc.). */
function actorMayEditUser(actorRole: string | null | undefined, target: UserSummary): boolean {
  return appRoleRank(target.app_role) <= appRoleRank(actorRole);
}

interface AccessRequestRow {
  id: string;
  full_name: string;
  email: string;
  phone?: string | null;
  reason?: string | null;
  student_id?: string | null;
  organization_id: string;
  status: "pending" | "approved" | "denied";
  created_date: string;
  reviewed_by?: string | null;
  reviewed_at?: string | null;
}

interface CurrentUser extends UserSummary {
  app_role: AppRole;
}

interface OrganizationOption {
  id: string;
  name: string;
}

const safeFormatDate = (value?: string | null, dateFormat: string = "MMM d, yyyy") => {
  if (!value) return "—";
  const date = new Date(value);
  if (isNaN(date.getTime())) return "—";
  return format(date, dateFormat);
};

const roleColors: Record<AppRole, string> = {
  student: "bg-blue-100 text-blue-800 border-blue-200 dark:bg-blue-900/30 dark:text-blue-200 dark:border-blue-900/50",
  reviewer: "bg-amber-100 text-amber-800 border-amber-200 dark:bg-amber-900/30 dark:text-amber-200 dark:border-amber-900/50",
  advisor: "bg-indigo-100 text-indigo-800 border-indigo-200 dark:bg-indigo-900/30 dark:text-indigo-200 dark:border-indigo-900/50",
  approver: "bg-purple-100 text-purple-800 border-purple-200 dark:bg-purple-900/30 dark:text-purple-200 dark:border-purple-900/50",
  fund_manager: "bg-emerald-100 text-emerald-800 border-emerald-200 dark:bg-emerald-900/30 dark:text-emerald-200 dark:border-emerald-900/50",
  admin: "bg-rose-100 text-rose-800 border-rose-200 dark:bg-rose-900/30 dark:text-rose-200 dark:border-rose-900/50",
  super_admin: "bg-fuchsia-100 text-fuchsia-800 border-fuchsia-200 dark:bg-fuchsia-900/30 dark:text-fuchsia-200 dark:border-fuchsia-900/50",
};

const roleIcons: Record<AppRole, React.ComponentType<{ className?: string }>> = {
  student: GraduationCap,
  reviewer: UserCheck,
  advisor: Shield,
  approver: Shield,
  fund_manager: UsersIcon,
  admin: Shield,
  super_admin: Shield,
};

export default function Users() {
  const queryClient = useQueryClient();
  const [currentUser, setCurrentUser] = useState<CurrentUser | null>(null);
  const [searchTerm, setSearchTerm] = useState("");
  const [roleFilter, setRoleFilter] = useState("all");
  const [showInviteModal, setShowInviteModal] = useState(false);
  const [showEditModal, setShowEditModal] = useState(false);
  const [editingUser, setEditingUser] = useState<UserSummary | null>(null);
  const [inviteEmail, setInviteEmail] = useState("");
  const [inviteRole, setInviteRole] = useState("student");
  const [submitting, setSubmitting] = useState(false);
  const [activeTab, setActiveTab] = useState("users");
  const [accessRequestsPage, setAccessRequestsPage] = useState(1);
  const [copiedOrgLink, setCopiedOrgLink] = useState(false);
  const usersPageTopRef = useRef<HTMLDivElement>(null);
  const copiedOrgLinkTimerRef = useRef<number | null>(null);

  useEffect(() => {
    loadUser();
  }, []);

  const loadUser = async () => {
    const user = await api.auth.me();
    setCurrentUser(user);
  };

  const { data: users = [], isLoading } = useQuery<UserSummary[]>({
    queryKey: ["allUsers"],
    queryFn: () => api.entities.User.list("-created_date") as Promise<UserSummary[]>,
  });

  const { data: accessRequests = [], isLoading: loadingRequests } = useQuery<AccessRequestRow[]>({
    queryKey: ["accessRequests"],
    queryFn: async () => {
      if (!currentUser?.organization_id) return [];
      return api.entities.AccessRequest.filter(
        { organization_id: currentUser.organization_id },
        "-created_date"
      ) as Promise<AccessRequestRow[]>;
    },
    enabled: !!currentUser?.organization_id,
  });

  useEffect(() => {
    const pages = Math.max(1, Math.ceil(accessRequests.length / ACCESS_REQUESTS_PAGE_SIZE));
    setAccessRequestsPage((p) => Math.min(Math.max(1, p), pages));
  }, [accessRequests.length]);

  useEffect(() => {
    return () => {
      if (copiedOrgLinkTimerRef.current !== null) {
        window.clearTimeout(copiedOrgLinkTimerRef.current);
      }
    };
  }, []);

  const canReassignOrganization =
    currentUser?.app_role === "admin" || currentUser?.app_role === "super_admin";

  const { data: organizations = [], isPending: organizationsLoading } = useQuery<OrganizationOption[]>({
    queryKey: ["organizations"],
    queryFn: () => api.entities.Organization.list("name") as Promise<OrganizationOption[]>,
    enabled: !!currentUser && canReassignOrganization,
  });

  const { data: inviteTargetOrganization, isPending: inviteOrgLoading } = useQuery<{
    name?: string;
    slug?: string | null;
    logo?: string | null;
  } | null>({
    queryKey: ["activeOrganization", currentUser?.organization_id],
    enabled: !!currentUser?.organization_id,
    queryFn: async ({ queryKey }) => {
      const id = queryKey[1] as string | undefined;
      if (!id) return null;
      const orgs = await api.entities.Organization.filter({ id }, undefined, 1);
      return orgs?.[0] ?? null;
    },
  });

  const updateAccessRequest = useMutation({
    mutationFn: ({ id, status }: { id: string; status: AccessRequestRow["status"] }) =>
      api.entities.AccessRequest.update(id, {
        status,
        reviewed_by: currentUser.full_name,
        reviewed_at: new Date().toISOString(),
      }),
    onSuccess: async (_, variables) => {
      queryClient.invalidateQueries({ queryKey: ["accessRequests"] });
      const request = accessRequests.find(r => r.id === variables.id);
      if (request && variables.status === "approved") {
        // Create an auth invite so the user receives an account creation email.
        await api.users.inviteUser(request.email, {
          app_role: "student",
          organization_id: request.organization_id,
        });
      }
    },
  });

  const filteredUsers = users.filter((user: UserSummary) => {
    const matchesSearch =
      user.full_name?.toLowerCase().includes(searchTerm.toLowerCase()) ||
      user.email?.toLowerCase().includes(searchTerm.toLowerCase());
    const matchesRole = roleFilter === "all" || user.app_role === roleFilter;
    return matchesSearch && matchesRole;
  });

  const roleCounts = {
    all: users.length,
    student: users.filter(u => u.app_role === "student" || !u.app_role).length,
    reviewer: users.filter(u => u.app_role === "reviewer").length,
    advisor: users.filter(u => u.app_role === "advisor").length,
    approver: users.filter(u => u.app_role === "approver").length,
    fund_manager: users.filter(u => u.app_role === "fund_manager").length,
    admin: users.filter(u => u.app_role === "admin").length,
  };

  const handleInvite = async () => {
    setSubmitting(true);
    const allowed = assignableAppRoles(currentUser.app_role);
    const roleToInvite = allowed.includes(inviteRole as AppRole)
      ? inviteRole
      : allowed[allowed.length - 1] ?? "student";
    await api.users.inviteUser(inviteEmail, {
      app_role: roleToInvite,
      organization_id: currentUser.organization_id ?? undefined,
    });
    setShowInviteModal(false);
    setInviteEmail("");
    setInviteRole("student");
    setSubmitting(false);
    queryClient.invalidateQueries({ queryKey: ["allUsers"] });
  };

  const openEditModal = (user: UserSummary) => {
    if (!currentUser || !actorMayEditUser(currentUser.app_role, user)) return;
    setEditingUser(user);
    setShowEditModal(true);
  };

  const handleUpdateUser = async (
    newRole: AppRole | null,
    permissions?: DashboardPermissions
  ) => {
    if (!editingUser || !currentUser) return;
    if (!actorMayEditUser(currentUser.app_role, editingUser)) {
      toast({
        title: "Cannot edit this user",
        description: "You cannot change users whose role is above your own.",
        variant: "destructive",
      });
      return;
    }
    setSubmitting(true);
    try {
      const actorRole = currentUser.app_role || "student";
      const initialRole = (editingUser.app_role || "student") as AppRole;
      let roleToSave: AppRole = (newRole || "student") as AppRole;

      if (appRoleRank(roleToSave) > appRoleRank(actorRole)) {
        roleToSave = APP_ROLE_ORDER[appRoleRank(actorRole)];
      }

      const payload: {
        app_role: AppRole;
        dashboard_permissions?: DashboardPermissions;
        organization_id?: string;
      } = {
        app_role: roleToSave,
        dashboard_permissions: permissions,
      };

      if (canReassignOrganization) {
        const oid = editingUser.organization_id;
        if (oid != null && oid !== "") {
          payload.organization_id = oid;
        }
      }

      await api.entities.User.update(editingUser.id, payload);

      queryClient.invalidateQueries({ queryKey: ["allUsers"] });
      setShowEditModal(false);
      setEditingUser(null);
    } finally {
      setSubmitting(false);
    }
  };

  const togglePermission = (key: keyof DashboardPermissions | string) => {
    if (!editingUser) return;
    const currentPermissions: DashboardPermissions = editingUser.dashboard_permissions || {};
    setEditingUser({
      ...editingUser,
      dashboard_permissions: {
        ...currentPermissions,
        [key]: !currentPermissions[key],
      },
    } as UserSummary);
  };

  const scrollUsersPageToTop = () => {
    const prefersReduced = window.matchMedia("(prefers-reduced-motion: reduce)").matches;
    const behavior: ScrollBehavior = prefersReduced ? "auto" : "smooth";
    const apply = () => {
      usersPageTopRef.current?.scrollIntoView({ behavior, block: "start" });
      const root = document.scrollingElement ?? document.documentElement;
      root.scrollTo({ top: 0, left: 0, behavior });
      window.scrollTo({ top: 0, left: 0, behavior });
      if (root !== document.body) {
        document.body.scrollTo({ top: 0, left: 0, behavior });
      }
    };
    requestAnimationFrame(() => {
      requestAnimationFrame(() => {
        setTimeout(apply, 0);
      });
    });
  };

  if (!currentUser) {
    return (
      <div className="flex items-center justify-center min-h-[60vh]">
        <LoadingSpinner size="lg" />
      </div>
    );
  }

  const pendingCount = accessRequests.filter(r => r.status === "pending").length;
  const rolesActorMayAssign = assignableAppRoles(currentUser.app_role);

  const accessRequestTotalPages = Math.max(
    1,
    Math.ceil(accessRequests.length / ACCESS_REQUESTS_PAGE_SIZE)
  );
  const accessRequestRangeStart = (accessRequestsPage - 1) * ACCESS_REQUESTS_PAGE_SIZE;
  const accessRequestRangeEnd = Math.min(
    accessRequestRangeStart + ACCESS_REQUESTS_PAGE_SIZE,
    accessRequests.length
  );
  const paginatedAccessRequests = accessRequests.slice(
    accessRequestRangeStart,
    accessRequestRangeStart + ACCESS_REQUESTS_PAGE_SIZE
  );
  const showAccessRequestPagination = accessRequests.length > ACCESS_REQUESTS_PAGE_SIZE;

  const renderAccessRequestsPager = (variant: "top" | "bottom") => {
    if (!showAccessRequestPagination) return null;
    const borderClass =
      variant === "top"
        ? "pb-4 mb-4 border-b border-slate-200/60 dark:border-slate-800/60"
        : "pt-4 mt-4 border-t border-slate-200/60 dark:border-slate-800/60";
    const navLabel =
      variant === "top"
        ? "Access requests pagination, top of list"
        : "Access requests pagination, end of list";
    return (
      <div
        className={`flex flex-col sm:flex-row sm:items-center sm:justify-between gap-3 ${borderClass}`}
      >
        <p className="text-sm text-slate-500 sm:order-1 dark:text-slate-400">
          Showing{" "}
          <span className="font-medium text-slate-700 tabular-nums dark:text-slate-200">
            {accessRequestRangeStart + 1}–{accessRequestRangeEnd}
          </span>{" "}
          of{" "}
          <span className="font-medium text-slate-700 tabular-nums dark:text-slate-200">{accessRequests.length}</span>
        </p>
        <nav
          className="flex flex-wrap items-center justify-center sm:justify-end gap-2 sm:order-2"
          aria-label={navLabel}
        >
          <Button
            type="button"
            variant="outline"
            size="sm"
            className="gap-1 cursor-pointer"
            onClick={() => {
              setAccessRequestsPage((p) => Math.max(1, p - 1));
              scrollUsersPageToTop();
            }}
            disabled={accessRequestsPage <= 1}
          >
            <ChevronLeft className="h-4 w-4" />
            Previous
          </Button>
          <span className="flex h-9 min-w-22 items-center justify-center px-2 text-sm text-slate-600 tabular-nums dark:text-slate-300">
            Page {accessRequestsPage} of {accessRequestTotalPages}
          </span>
          <Button
            type="button"
            variant="outline"
            size="sm"
            className="gap-1 cursor-pointer"
            onClick={() => {
              setAccessRequestsPage((p) => Math.min(accessRequestTotalPages, p + 1));
              scrollUsersPageToTop();
            }}
            disabled={accessRequestsPage >= accessRequestTotalPages}
          >
            Next
            <ChevronRight className="h-4 w-4" />
          </Button>
        </nav>
      </div>
    );
  };

  return (
    <div ref={usersPageTopRef} className="space-y-6 scroll-mt-20 lg:scroll-mt-4">
      <PageHeader
        title="User Management"
        description="Manage users, roles, and access requests"
        actions={
          activeTab === "users" && (
            <>
              {currentUser.organization_id &&
                inviteTargetOrganization?.slug?.trim() &&
                !inviteOrgLoading && (
                  <Button
                    type="button"
                    variant="outline"
                    className={`cursor-pointer shrink-0 transition-all duration-300 ${
                      copiedOrgLink
                        ? "border-emerald-300 bg-emerald-50 text-emerald-900 hover:bg-emerald-100 dark:border-emerald-800/60 dark:bg-emerald-950/30 dark:text-emerald-100 dark:hover:bg-emerald-900/30"
                        : ""
                    }`}
                    onClick={async () => {
                      const slug = inviteTargetOrganization.slug!.trim();
                      const path = `/org/${encodeURIComponent(slug)}`;
                      const href = `${window.location.origin}${path}`;
                      try {
                        await navigator.clipboard.writeText(href);
                        setCopiedOrgLink(true);
                        if (copiedOrgLinkTimerRef.current !== null) {
                          window.clearTimeout(copiedOrgLinkTimerRef.current);
                        }
                        copiedOrgLinkTimerRef.current = window.setTimeout(() => {
                          setCopiedOrgLink(false);
                          copiedOrgLinkTimerRef.current = null;
                        }, 1600);
                      } catch {
                        setCopiedOrgLink(false);
                      }
                    }}
                  >
                    {copiedOrgLink ? (
                      <Check className="w-4 h-4 mr-2 motion-safe:animate-in motion-safe:zoom-in-90" />
                    ) : (
                      <Copy className="w-4 h-4 mr-2 motion-safe:animate-in motion-safe:fade-in-50" />
                    )}
                    {copiedOrgLink ? "Copied!" : "Copy Link"}
                  </Button>
                )}
              <Button
                onClick={() => {
                  setInviteEmail("");
                  setInviteRole("student");
                  setShowInviteModal(true);
                }}
                className="bg-linear-to-r from-indigo-600 to-violet-600 hover:from-indigo-700 hover:to-violet-700 text-white"
              >
                <UserPlus className="w-4 h-4 mr-2" />
                Invite User
              </Button>
            </>
          )
        }
      />

      <Tabs value={activeTab} onValueChange={setActiveTab}>
        <TabsList>
          <TabsTrigger value="users">
            <UsersIcon className="w-4 h-4 mr-2" />
            Users
          </TabsTrigger>
          <TabsTrigger value="access">
            <ClipboardList className="w-4 h-4 mr-2" />
            Access Requests
            {pendingCount > 0 && (
              <Badge className="ml-2 bg-red-500 text-white text-xs px-1.5 py-0.5 rounded-full">
                {pendingCount}
              </Badge>
            )}
          </TabsTrigger>
        </TabsList>

        <TabsContent value="users" className="space-y-4 mt-4">
      {/* Filters */}
      <Card className="bg-white/70 backdrop-blur-xs border-slate-200/50 dark:bg-slate-900/70 dark:border-slate-800/50">
        <CardContent className="p-4">
          <div className="flex flex-col sm:flex-row gap-4">
            <div className="relative flex-1">
              <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-slate-400 dark:text-slate-500" />
              <Input
                placeholder="Search users..."
                className="pl-9"
                value={searchTerm}
                onChange={(e) => setSearchTerm(e.target.value)}
              />
            </div>
            <Select value={roleFilter} onValueChange={setRoleFilter}>
              <SelectTrigger className="w-full sm:w-48">
                <Filter className="w-4 h-4 mr-2" />
                <SelectValue placeholder="Filter by role" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="all">All Roles ({roleCounts.all})</SelectItem>
                <SelectItem value="student">Students ({roleCounts.student})</SelectItem>
                <SelectItem value="reviewer">Reviewers ({roleCounts.reviewer})</SelectItem>
                <SelectItem value="advisor">Advisors ({roleCounts.advisor})</SelectItem>
                <SelectItem value="approver">Approvers ({roleCounts.approver})</SelectItem>
                <SelectItem value="fund_manager">Fund Managers ({roleCounts.fund_manager})</SelectItem>
                <SelectItem value="admin">Admins ({roleCounts.admin})</SelectItem>
              </SelectContent>
            </Select>
          </div>
        </CardContent>
      </Card>

      {/* Users Table */}
      <Card className="bg-white/70 backdrop-blur-xs border-slate-200/50 overflow-hidden dark:bg-slate-900/70 dark:border-slate-800/50">
        {isLoading ? (
          <LoadingSpinner className="py-16" />
        ) : filteredUsers.length === 0 ? (
          <EmptyState
            icon={UsersIcon}
            title="No Users Found"
            description="No users match your search criteria."
          />
        ) : (
          <>
            {/* Mobile View */}
            <div className="md:hidden divide-y">
              {filteredUsers.map((user) => {
                const RoleIcon = roleIcons[user.app_role] || GraduationCap;
                return (
                  <div key={user.id} className="p-4">
                    <div className="flex items-start justify-between mb-2">
                      <div className="flex items-center gap-3">
                        <div className={`w-10 h-10 rounded-full flex items-center justify-center ${roleColors[user.app_role] || roleColors.student}`}>
                          <RoleIcon className="w-5 h-5" />
                        </div>
                        <div>
                          <p className="font-semibold text-slate-800 dark:text-slate-100">{user.full_name || "No name"}</p>
                          <p className="text-sm text-slate-500 dark:text-slate-400">{user.email}</p>
                        </div>
                      </div>
                      {actorMayEditUser(currentUser.app_role, user) && (
                        <Button variant="ghost" size="sm" onClick={() => openEditModal(user)}>
                          <Edit className="w-4 h-4" />
                        </Button>
                      )}
                    </div>
                    <div className="flex items-center gap-2 mt-2">
                      <Badge variant="outline" className={roleColors[user.app_role] || roleColors.student}>
                        {(user.app_role || "student").replace("_", " ")}
                      </Badge>
                      <StatusBadge status={user.status || "active"} />
                    </div>
                  </div>
                );
              })}
            </div>

            {/* Desktop View */}
            <div className="hidden md:block">
              <Table>
                <TableHeader>
                  <TableRow className="bg-slate-50/50 dark:bg-slate-900/50">
                    <TableHead>User</TableHead>
                    <TableHead>Email</TableHead>
                    <TableHead>Role</TableHead>
                    <TableHead>Status</TableHead>
                    <TableHead>Joined</TableHead>
                    <TableHead className="w-20">Actions</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {filteredUsers.map((user) => {
                    const RoleIcon = roleIcons[user.app_role] || GraduationCap;
                    return (
                      <TableRow key={user.id} className="hover:bg-slate-50/50 dark:hover:bg-slate-800/50">
                        <TableCell>
                          <div className="flex items-center gap-3">
                            <div className={`w-10 h-10 rounded-full flex items-center justify-center ${roleColors[user.app_role] || roleColors.student}`}>
                              <RoleIcon className="w-5 h-5" />
                            </div>
                            <div>
                              <p className="font-medium">{user.full_name || "No name"}</p>
                              {user.phone && (
                                <p className="text-xs text-slate-500 flex items-center gap-1 dark:text-slate-400">
                                  <Phone className="w-3 h-3" /> {user.phone}
                                </p>
                              )}
                            </div>
                          </div>
                        </TableCell>
                        <TableCell>
                          <div className="flex items-center gap-1 text-slate-600 dark:text-slate-300">
                            <Mail className="w-4 h-4" />
                            {user.email}
                          </div>
                        </TableCell>
                        <TableCell>
                          <Badge variant="outline" className={`${roleColors[user.app_role] || roleColors.student} capitalize`}>
                            {(user.app_role || "student").replace("_", " ")}
                          </Badge>
                        </TableCell>
                        <TableCell>
                          <StatusBadge status={user.status || "active"} />
                        </TableCell>
                        <TableCell className="text-slate-500 dark:text-slate-400">
                          {safeFormatDate(user.created_date)}
                        </TableCell>
                        <TableCell>
                          {actorMayEditUser(currentUser.app_role, user) ? (
                            <DropdownMenu>
                              <DropdownMenuTrigger asChild>
                                <Button variant="ghost" size="sm">
                                  <MoreHorizontal className="w-4 h-4" />
                                </Button>
                              </DropdownMenuTrigger>
                              <DropdownMenuContent align="end">
                                <DropdownMenuItem onClick={() => openEditModal(user)}>
                                  <Edit className="w-4 h-4 mr-2" /> Edit User
                                </DropdownMenuItem>
                              </DropdownMenuContent>
                            </DropdownMenu>
                          ) : (
                            <span className="text-slate-300 text-sm">—</span>
                          )}
                        </TableCell>
                      </TableRow>
                    );
                  })}
                </TableBody>
              </Table>
            </div>
          </>
        )}
      </Card>
        </TabsContent>

        <TabsContent value="access" className="mt-4">
          {loadingRequests ? (
            <LoadingSpinner className="py-16" />
          ) : accessRequests.length === 0 ? (
            <EmptyState
              icon={Mail}
              title="No Access Requests"
              description="No students have requested access yet."
            />
          ) : (
            <>
            {renderAccessRequestsPager("top")}
            <div className="space-y-4">
              {paginatedAccessRequests.map((request) => {
                const initial = (request.full_name || request.email || "?").trim().charAt(0).toUpperCase();
                const borderAccent =
                  request.status === "pending"
                    ? "border-l-indigo-500"
                    : request.status === "approved"
                      ? "border-l-emerald-400"
                      : "border-l-slate-300";
                return (
                  <article
                    key={request.id}
                    className={`rounded-xl border border-slate-200/80 bg-white/90 shadow-sm border-l-4 ${borderAccent} overflow-hidden dark:border-slate-800/80 dark:bg-slate-900/70`}
                  >
                    <div className="p-4 sm:p-5 space-y-4">
                      <div className="flex gap-3 sm:gap-4">
                        <div
                          className="shrink-0 w-11 h-11 sm:w-12 sm:h-12 rounded-full bg-linear-to-br from-indigo-500 to-violet-600 text-white font-semibold text-sm sm:text-base flex items-center justify-center shadow-inner"
                          aria-hidden
                        >
                          {initial}
                        </div>
                        <div className="min-w-0 flex-1 space-y-1">
                          <div className="flex flex-col gap-2 sm:flex-row sm:items-start sm:justify-between sm:gap-3">
                            <div className="min-w-0">
                              <h3 className="font-semibold text-slate-900 leading-snug dark:text-slate-50">
                                {request.full_name || "Unnamed applicant"}
                              </h3>
                              <p className="text-sm text-slate-500 flex items-center gap-1.5 mt-0.5 dark:text-slate-400">
                                <Mail className="w-3.5 h-3.5 shrink-0" />
                                <span className="truncate">{request.email}</span>
                              </p>
                              {request.phone && (
                                <p className="text-sm text-slate-500 flex items-center gap-1.5 mt-0.5 dark:text-slate-400">
                                  <Phone className="w-3.5 h-3.5 shrink-0" />
                                  {request.phone}
                                </p>
                              )}
                            </div>
                            <div className="flex flex-wrap items-center gap-2 shrink-0">
                              <StatusBadge status={request.status} />
                              <time
                                className="text-xs text-slate-400 tabular-nums dark:text-slate-500"
                                dateTime={request.created_date}
                                title={request.created_date}
                              >
                                {safeFormatDate(request.created_date, "MMM d, yyyy 'at' h:mm a")}
                              </time>
                            </div>
                          </div>
                          {request.student_id && (
                            <p className="text-xs text-slate-500 dark:text-slate-400">
                              Student ID: <span className="font-mono text-slate-600 dark:text-slate-300">{request.student_id}</span>
                            </p>
                          )}
                        </div>
                      </div>

                      <div className="pl-0 sm:pl-13 space-y-2">
                        <div className="flex items-center gap-2 text-xs font-medium uppercase tracking-wide text-slate-500 dark:text-slate-400">
                          <MessageSquare className="w-3.5 h-3.5" />
                          Reason
                        </div>
                        <div className="rounded-lg bg-slate-50/90 border border-slate-100 px-4 py-3.5 text-sm text-slate-700 leading-relaxed whitespace-pre-wrap wrap-break-word min-h-12 dark:text-slate-200 dark:bg-slate-900/90 dark:border-slate-800">
                          {request.reason?.trim() ? request.reason : (
                            <span className="text-slate-400 italic dark:text-slate-500">No reason provided.</span>
                          )}
                        </div>
                      </div>

                      {request.status === "pending" ? (
                        <div className="pl-0 sm:pl-13 flex flex-col sm:flex-row gap-2 sm:justify-end">
                          <Button
                            size="sm"
                            variant="outline"
                            className="border-green-300 text-green-700 hover:bg-green-50 sm:min-w-28 dark:border-green-800/60 dark:text-green-300 dark:hover:bg-green-950/30"
                            onClick={() => updateAccessRequest.mutate({ id: request.id, status: "approved" })}
                            disabled={updateAccessRequest.isPending}
                          >
                            <Check className="w-3.5 h-3.5 mr-1.5" /> Approve
                          </Button>
                          <Button
                            size="sm"
                            variant="outline"
                            className="border-red-300 text-red-700 hover:bg-red-50 sm:min-w-28 dark:border-red-800/60 dark:text-red-300 dark:hover:bg-red-950/30"
                            onClick={() => updateAccessRequest.mutate({ id: request.id, status: "denied" })}
                            disabled={updateAccessRequest.isPending}
                          >
                            <X className="w-3.5 h-3.5 mr-1.5" /> Deny
                          </Button>
                        </div>
                      ) : (
                        (request.reviewed_by || request.reviewed_at) && (
                          <div className="pl-0 sm:pl-13 text-sm text-slate-500 border-t border-slate-100 pt-3 dark:text-slate-400 dark:border-slate-800">
                            {request.reviewed_by && <span>Reviewed by {request.reviewed_by}</span>}
                            {request.reviewed_by && request.reviewed_at && <span className="text-slate-300 mx-1.5">·</span>}
                            {request.reviewed_at && (
                              <time dateTime={request.reviewed_at}>
                                {safeFormatDate(request.reviewed_at, "MMM d, yyyy 'at' h:mm a")}
                              </time>
                            )}
                          </div>
                        )
                      )}
                    </div>
                  </article>
                );
              })}
            </div>
            {renderAccessRequestsPager("bottom")}
            </>
          )}
        </TabsContent>
      </Tabs>

      {/* Invite Modal */}
      <Dialog open={showInviteModal} onOpenChange={setShowInviteModal}>
        <DialogContent className="sm:max-w-lg">
          <DialogHeader>
            <DialogTitle>Invite User</DialogTitle>
            <DialogDescription>
              Send an invitation to join the platform.
            </DialogDescription>
          </DialogHeader>
          {currentUser?.organization_id ? (
            <div className="rounded-xl border-2 border-indigo-200 bg-linear-to-br from-indigo-50 to-violet-50 px-5 py-5 text-center shadow-sm dark:border-indigo-900/50 dark:from-indigo-950/30 dark:to-violet-950/30">
              <div className="flex flex-col items-center gap-3">
                {inviteOrgLoading ? (
                  <div
                    className="w-14 h-14 rounded-xl bg-indigo-200/50 animate-pulse shrink-0 dark:bg-indigo-900/40"
                    aria-hidden
                  />
                ) : (
                  <div className="w-14 h-14 rounded-xl flex items-center justify-center shadow-lg shadow-indigo-500/20 overflow-hidden bg-linear-to-br from-indigo-600 to-violet-600 shrink-0">
                    {inviteTargetOrganization?.logo ? (
                      <img
                        src={inviteTargetOrganization.logo}
                        alt={`${inviteTargetOrganization?.name || "Organization"} logo`}
                        className="w-full h-full object-cover"
                      />
                    ) : (
                      <GraduationCap className="w-8 h-8 text-white" aria-hidden />
                    )}
                  </div>
                )}
                <div className="text-sm font-semibold uppercase tracking-wide text-indigo-800 dark:text-indigo-200">
                  You are inviting to
                </div>
              </div>
              <p className="mt-2 text-2xl font-bold tracking-tight text-indigo-950 wrap-break-word">
                {inviteTargetOrganization?.name ?? "Loading organization…"}
              </p>
              {(currentUser.app_role === "admin" || currentUser.app_role === "super_admin") && (
                <p className="mt-3 text-sm leading-snug text-indigo-900/85 dark:text-indigo-100">
                  This is your currently selected organization. They will join this one. To invite elsewhere,
                  switch organization in{" "}
                  <Link
                    to={createPageUrl("Settings")}
                    className="font-semibold text-indigo-800 underline underline-offset-2 hover:text-indigo-950 dark:text-indigo-200"
                  >
                    Settings
                  </Link>
                  .
                </p>
              )}
            </div>
          ) : (
            <div
              className="rounded-xl border-2 border-amber-300 bg-amber-50 px-4 py-4 text-center text-sm font-medium text-amber-950 dark:border-amber-800/60 dark:bg-amber-950/30"
              role="alert"
            >
              No organization is selected. Choose an organization in Settings before sending invitations.
            </div>
          )}
          <div className="space-y-4 py-4">
            <div className="space-y-2">
              <Label>Email Address *</Label>
              <Input
                type="email"
                value={inviteEmail}
                onChange={(e) => setInviteEmail(e.target.value)}
                placeholder="user@example.com"
              />
            </div>
            <div className="space-y-2">
              <Label>Role</Label>
              <Select
                value={
                  rolesActorMayAssign.includes(inviteRole as AppRole)
                    ? inviteRole
                    : rolesActorMayAssign[rolesActorMayAssign.length - 1] ?? "student"
                }
                onValueChange={setInviteRole}
              >
                <SelectTrigger>
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  {rolesActorMayAssign.map((role) => (
                    <SelectItem key={role} value={role}>
                      {formatRoleOption(role)}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
              <p className="text-xs text-slate-500 dark:text-slate-400">
                They will be added to your organization when the invitation is sent.
              </p>
            </div>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setShowInviteModal(false)}>
              Cancel
            </Button>
            <Button
              onClick={handleInvite}
              disabled={!inviteEmail || submitting}
              className="bg-indigo-600 hover:bg-indigo-700 text-white"
            >
              {submitting ? <LoadingSpinner size="sm" className="mr-2" /> : <Mail className="w-4 h-4 mr-2" />}
              Send Invitation
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Edit User Modal */}
      <Dialog open={showEditModal} onOpenChange={setShowEditModal}>
        <DialogContent className="sm:max-w-2xl max-h-[90vh] overflow-y-auto">
          <DialogHeader>
            <DialogTitle>Edit User</DialogTitle>
            <DialogDescription>
              Update user role and permissions.
            </DialogDescription>
          </DialogHeader>
          {editingUser && (
            <Tabs defaultValue="basic" className="w-full">
              <TabsList className="grid w-full grid-cols-2">
                <TabsTrigger value="basic">Basic Info</TabsTrigger>
                <TabsTrigger value="permissions">
                  <SettingsIcon className="w-4 h-4 mr-2" />
                  Permissions
                </TabsTrigger>
              </TabsList>
              
              <TabsContent value="basic" className="space-y-4 pt-4">
                <div className="p-4 bg-slate-50 rounded-lg dark:bg-slate-900">
                  <p className="font-medium">{editingUser.full_name}</p>
                  <p className="text-sm text-slate-500 dark:text-slate-400">{editingUser.email}</p>
                </div>
                <div className="space-y-2">
                  <Label>Role</Label>
                  <Select
                    value={editingUser.app_role || "student"}
                    onValueChange={(value) =>
                      setEditingUser({ ...editingUser, app_role: value as AppRole })
                    }
                  >
                    <SelectTrigger>
                      <SelectValue />
                    </SelectTrigger>
                    <SelectContent>
                      {rolesActorMayAssign.map((role) => (
                        <SelectItem key={role} value={role}>
                          {formatRoleOption(role)}
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </div>
                {canReassignOrganization && (
                  <div className="space-y-2">
                    <Label className="flex items-center gap-2">
                      <Building2 className="w-4 h-4 text-slate-500 dark:text-slate-400" aria-hidden />
                      Organization
                    </Label>
                    {organizationsLoading ? (
                      <p className="text-sm text-slate-500 dark:text-slate-400">Loading organizations…</p>
                    ) : (
                      <Select
                        value={editingUser.organization_id ?? undefined}
                        onValueChange={(value) =>
                          setEditingUser({
                            ...editingUser,
                            organization_id: value,
                          })
                        }
                      >
                        <SelectTrigger>
                          <SelectValue placeholder="Select organization" />
                        </SelectTrigger>
                        <SelectContent>
                          {editingUser.organization_id &&
                            !organizations.some((o) => o.id === editingUser.organization_id) && (
                              <SelectItem value={editingUser.organization_id}>
                                {editingUser.organization_id} (not in list)
                              </SelectItem>
                            )}
                          {organizations.map((org) => (
                            <SelectItem key={org.id} value={org.id}>
                              {org.name}
                            </SelectItem>
                          ))}
                        </SelectContent>
                      </Select>
                    )}
                    <p className="text-xs text-slate-500 dark:text-slate-400">
                      {currentUser.app_role === "super_admin"
                        ? "Assign this user to any organization."
                        : "Move this user to another organization. They will lose access to this org’s data."}
                    </p>
                  </div>
                )}
              </TabsContent>
              
              <TabsContent value="permissions" className="space-y-4 pt-4">
                <div className="space-y-1 mb-4">
                  <p className="text-sm font-medium">Dashboard Permissions</p>
                  <p className="text-xs text-slate-500 dark:text-slate-400">Control what sections this user can access in the dashboard</p>
                </div>
                
                <div className="space-y-3">
                  <div className="flex items-center justify-between py-2 border-b">
                    <div>
                      <p className="font-medium text-sm">View Statistics</p>
                      <p className="text-xs text-slate-500 dark:text-slate-400">Access to stats cards on dashboard</p>
                    </div>
                    <Switch
                      checked={editingUser.dashboard_permissions?.view_stats !== false}
                      onCheckedChange={() => togglePermission('view_stats')}
                    />
                  </div>
                  
                  <div className="flex items-center justify-between py-2 border-b">
                    <div>
                      <p className="font-medium text-sm">View Pending Requests</p>
                      <p className="text-xs text-slate-500 dark:text-slate-400">See pending requests section</p>
                    </div>
                    <Switch
                      checked={editingUser.dashboard_permissions?.view_pending_requests !== false}
                      onCheckedChange={() => togglePermission('view_pending_requests')}
                    />
                  </div>
                  
                  <div className="flex items-center justify-between py-2 border-b">
                    <div>
                      <p className="font-medium text-sm">View Fund Overview</p>
                      <p className="text-xs text-slate-500 dark:text-slate-400">See fund overview section</p>
                    </div>
                    <Switch
                      checked={editingUser.dashboard_permissions?.view_fund_overview !== false}
                      onCheckedChange={() => togglePermission('view_fund_overview')}
                    />
                  </div>
                  
                  <div className="flex items-center justify-between py-2 border-b">
                    <div>
                      <p className="font-medium text-sm">Access Review Queue</p>
                      <p className="text-xs text-slate-500 dark:text-slate-400">Navigate to review queue page</p>
                    </div>
                    <Switch
                      checked={editingUser.dashboard_permissions?.access_queue !== false}
                      onCheckedChange={() => togglePermission('access_queue')}
                    />
                  </div>
                  
                  <div className="flex items-center justify-between py-2 border-b">
                    <div>
                      <p className="font-medium text-sm">Access Funds Management</p>
                      <p className="text-xs text-slate-500 dark:text-slate-400">View and manage funds</p>
                    </div>
                    <Switch
                      checked={editingUser.dashboard_permissions?.access_funds !== false}
                      onCheckedChange={() => togglePermission('access_funds')}
                    />
                  </div>
                  
                  <div className="flex items-center justify-between py-2 border-b">
                    <div>
                      <p className="font-medium text-sm">Access Reports</p>
                      <p className="text-xs text-slate-500 dark:text-slate-400">View reporting dashboard</p>
                    </div>
                    <Switch
                      checked={editingUser.dashboard_permissions?.access_reports !== false}
                      onCheckedChange={() => togglePermission('access_reports')}
                    />
                  </div>
                  
                  <div className="flex items-center justify-between py-2 border-b">
                    <div>
                      <p className="font-medium text-sm">Access Routing Rules</p>
                      <p className="text-xs text-slate-500 dark:text-slate-400">Configure fund routing</p>
                    </div>
                    <Switch
                      checked={editingUser.dashboard_permissions?.access_rules === true}
                      onCheckedChange={() => togglePermission('access_rules')}
                    />
                  </div>
                  
                  <div className="flex items-center justify-between py-2 border-b">
                    <div>
                      <p className="font-medium text-sm">Access User Management</p>
                      <p className="text-xs text-slate-500 dark:text-slate-400">Manage users and roles</p>
                    </div>
                    <Switch
                      checked={editingUser.dashboard_permissions?.access_users === true}
                      onCheckedChange={() => togglePermission('access_users')}
                    />
                  </div>
                  
                  <div className="flex items-center justify-between py-2 border-b">
                    <div>
                      <p className="font-medium text-sm">Access Audit Log</p>
                      <p className="text-xs text-slate-500 dark:text-slate-400">View system audit trail</p>
                    </div>
                    <Switch
                      checked={editingUser.dashboard_permissions?.access_audit_log === true}
                      onCheckedChange={() => togglePermission('access_audit_log')}
                    />
                  </div>
                  
                  <div className="flex items-center justify-between py-2">
                    <div>
                      <p className="font-medium text-sm">Access Settings</p>
                      <p className="text-xs text-slate-500 dark:text-slate-400">Modify system settings</p>
                    </div>
                    <Switch
                      checked={editingUser.dashboard_permissions?.access_settings === true}
                      onCheckedChange={() => togglePermission('access_settings')}
                    />
                  </div>
                </div>
              </TabsContent>
            </Tabs>
          )}
          <DialogFooter>
            <Button variant="outline" onClick={() => setShowEditModal(false)}>
              Cancel
            </Button>
            <Button
              onClick={() => handleUpdateUser(editingUser.app_role, editingUser.dashboard_permissions)}
              disabled={submitting}
              className="bg-indigo-600 hover:bg-indigo-700 text-white"
            >
              {submitting ? <LoadingSpinner size="sm" className="mr-2" /> : null}
              Save Changes
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}