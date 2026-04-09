import React, { useState, useEffect } from "react";
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
} from "lucide-react";
import { format } from "date-fns";
import { useMutation } from "@tanstack/react-query";

type AppRole = "student" | "reviewer" | "advisor" | "approver" | "fund_manager" | "admin" | "super_admin";

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

const safeFormatDate = (value?: string | null, dateFormat: string = "MMM d, yyyy") => {
  if (!value) return "—";
  const date = new Date(value);
  if (isNaN(date.getTime())) return "—";
  return format(date, dateFormat);
};

const roleColors: Record<AppRole, string> = {
  student: "bg-blue-100 text-blue-800 border-blue-200",
  reviewer: "bg-amber-100 text-amber-800 border-amber-200",
  advisor: "bg-indigo-100 text-indigo-800 border-indigo-200",
  approver: "bg-purple-100 text-purple-800 border-purple-200",
  fund_manager: "bg-emerald-100 text-emerald-800 border-emerald-200",
  admin: "bg-rose-100 text-rose-800 border-rose-200",
  super_admin: "bg-fuchsia-100 text-fuchsia-800 border-fuchsia-200",
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

  const { data: inviteTargetOrganization, isPending: inviteOrgLoading } = useQuery<{
    name?: string;
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
    setEditingUser(user);
    setShowEditModal(true);
  };

  const handleUpdateUser = async (
    newRole: AppRole | null,
    permissions?: DashboardPermissions
  ) => {
    if (!editingUser) return;
    setSubmitting(true);
    try {
      const actorRole = currentUser.app_role || "student";
      const initialRole = (editingUser.app_role || "student") as AppRole;
      let roleToSave: AppRole = (newRole || "student") as AppRole;

      if (appRoleRank(initialRole) > appRoleRank(actorRole)) {
        roleToSave = initialRole;
      } else if (appRoleRank(roleToSave) > appRoleRank(actorRole)) {
        roleToSave = APP_ROLE_ORDER[appRoleRank(actorRole)];
      }

      await api.entities.User.update(editingUser.id, {
        app_role: roleToSave,
        dashboard_permissions: permissions,
      });

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

  if (!currentUser) {
    return (
      <div className="flex items-center justify-center min-h-[60vh]">
        <LoadingSpinner size="lg" />
      </div>
    );
  }

  const pendingCount = accessRequests.filter(r => r.status === "pending").length;
  const rolesActorMayAssign = assignableAppRoles(currentUser.app_role);

  return (
    <div className="space-y-6">
      <PageHeader
        title="User Management"
        description="Manage users, roles, and access requests"
        actions={
          activeTab === "users" && (
            <Button
              onClick={() => {
                setInviteEmail("");
                setInviteRole("student");
                setShowInviteModal(true);
              }}
              className="bg-linear-to-r from-indigo-600 to-violet-600 hover:from-indigo-700 hover:to-violet-700"
            >
              <UserPlus className="w-4 h-4 mr-2" />
              Invite User
            </Button>
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
      <Card className="bg-white/70 backdrop-blur-xs border-slate-200/50">
        <CardContent className="p-4">
          <div className="flex flex-col sm:flex-row gap-4">
            <div className="relative flex-1">
              <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-slate-400" />
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
      <Card className="bg-white/70 backdrop-blur-xs border-slate-200/50 overflow-hidden">
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
                          <p className="font-semibold text-slate-800">{user.full_name || "No name"}</p>
                          <p className="text-sm text-slate-500">{user.email}</p>
                        </div>
                      </div>
                      <Button variant="ghost" size="sm" onClick={() => openEditModal(user)}>
                        <Edit className="w-4 h-4" />
                      </Button>
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
                  <TableRow className="bg-slate-50/50">
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
                      <TableRow key={user.id} className="hover:bg-slate-50/50">
                        <TableCell>
                          <div className="flex items-center gap-3">
                            <div className={`w-10 h-10 rounded-full flex items-center justify-center ${roleColors[user.app_role] || roleColors.student}`}>
                              <RoleIcon className="w-5 h-5" />
                            </div>
                            <div>
                              <p className="font-medium">{user.full_name || "No name"}</p>
                              {user.phone && (
                                <p className="text-xs text-slate-500 flex items-center gap-1">
                                  <Phone className="w-3 h-3" /> {user.phone}
                                </p>
                              )}
                            </div>
                          </div>
                        </TableCell>
                        <TableCell>
                          <div className="flex items-center gap-1 text-slate-600">
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
                        <TableCell className="text-slate-500">
                          {safeFormatDate(user.created_date)}
                        </TableCell>
                        <TableCell>
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
          <Card className="bg-white/70 backdrop-blur-xs border-slate-200/50">
            <CardContent className="p-0">
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
                  {/* Mobile */}
                  <div className="md:hidden divide-y">
                    {accessRequests.map((request) => (
                      <div key={request.id} className="p-4 space-y-2">
                        <div className="flex items-start justify-between">
                          <div>
                            <p className="font-semibold text-slate-800">{request.full_name}</p>
                            <p className="text-sm text-slate-500">{request.email}</p>
                            {request.phone && <p className="text-sm text-slate-500">{request.phone}</p>}
                          </div>
                          <StatusBadge status={request.status} />
                        </div>
                        {request.reason && <p className="text-sm text-slate-600">{request.reason}</p>}
                        <p className="text-xs text-slate-400">{safeFormatDate(request.created_date)}</p>
                        {request.status === "pending" && (
                          <div className="flex gap-2 pt-1">
                            <Button size="sm" variant="outline" className="flex-1 border-green-300 text-green-700 hover:bg-green-50"
                              onClick={() => updateAccessRequest.mutate({ id: request.id, status: "approved" })}
                              disabled={updateAccessRequest.isPending}>
                              <Check className="w-3 h-3 mr-1" /> Approve
                            </Button>
                            <Button size="sm" variant="outline" className="flex-1 border-red-300 text-red-700 hover:bg-red-50"
                              onClick={() => updateAccessRequest.mutate({ id: request.id, status: "denied" })}
                              disabled={updateAccessRequest.isPending}>
                              <X className="w-3 h-3 mr-1" /> Deny
                            </Button>
                          </div>
                        )}
                      </div>
                    ))}
                  </div>
                  {/* Desktop */}
                  <div className="hidden md:block overflow-x-auto">
                    <Table>
                      <TableHeader>
                        <TableRow className="bg-slate-50/50">
                          <TableHead>Student</TableHead>
                          <TableHead>Contact</TableHead>
                          <TableHead>Student ID</TableHead>
                          <TableHead>Reason</TableHead>
                          <TableHead>Date</TableHead>
                          <TableHead>Status</TableHead>
                          <TableHead>Actions</TableHead>
                        </TableRow>
                      </TableHeader>
                      <TableBody>
                        {accessRequests.map((request) => (
                          <TableRow key={request.id} className="hover:bg-slate-50/50">
                            <TableCell className="font-medium">{request.full_name}</TableCell>
                            <TableCell>
                              <div className="text-sm">
                                <p>{request.email}</p>
                                {request.phone && <p className="text-slate-500">{request.phone}</p>}
                              </div>
                            </TableCell>
                            <TableCell>{request.student_id || "-"}</TableCell>
                            <TableCell className="max-w-xs">
                              <p className="text-sm text-slate-600 line-clamp-2">{request.reason}</p>
                            </TableCell>
                            <TableCell className="text-sm text-slate-500">
                              {safeFormatDate(request.created_date)}
                            </TableCell>
                            <TableCell>
                              <StatusBadge status={request.status} />
                            </TableCell>
                            <TableCell>
                              {request.status === "pending" ? (
                                <div className="flex gap-2">
                                  <Button size="sm" variant="outline" className="border-green-300 text-green-700 hover:bg-green-50"
                                    onClick={() => updateAccessRequest.mutate({ id: request.id, status: "approved" })}
                                    disabled={updateAccessRequest.isPending}>
                                    <Check className="w-3 h-3 mr-1" /> Approve
                                  </Button>
                                  <Button size="sm" variant="outline" className="border-red-300 text-red-700 hover:bg-red-50"
                                    onClick={() => updateAccessRequest.mutate({ id: request.id, status: "denied" })}
                                    disabled={updateAccessRequest.isPending}>
                                    <X className="w-3 h-3 mr-1" /> Deny
                                  </Button>
                                </div>
                              ) : (
                                <div className="text-sm text-slate-500">
                                  {request.reviewed_by && <p>By {request.reviewed_by}</p>}
                                </div>
                              )}
                            </TableCell>
                          </TableRow>
                        ))}
                      </TableBody>
                    </Table>
                  </div>
                </>
              )}
            </CardContent>
          </Card>
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
            <div className="rounded-xl border-2 border-indigo-200 bg-linear-to-br from-indigo-50 to-violet-50 px-5 py-5 text-center shadow-sm">
              <div className="flex flex-col items-center gap-3">
                {inviteOrgLoading ? (
                  <div
                    className="w-14 h-14 rounded-xl bg-indigo-200/50 animate-pulse shrink-0"
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
                <div className="text-sm font-semibold uppercase tracking-wide text-indigo-800">
                  You are inviting to
                </div>
              </div>
              <p className="mt-2 text-2xl font-bold tracking-tight text-indigo-950 wrap-break-word">
                {inviteTargetOrganization?.name ?? "Loading organization…"}
              </p>
              <p className="mt-3 text-sm leading-snug text-indigo-900/85">
                This is your currently selected organization. They will join this one. To invite elsewhere,
                switch organization in{" "}
                <Link
                  to={createPageUrl("Settings")}
                  className="font-semibold text-indigo-800 underline underline-offset-2 hover:text-indigo-950"
                >
                  Settings
                </Link>
                .
              </p>
            </div>
          ) : (
            <div
              className="rounded-xl border-2 border-amber-300 bg-amber-50 px-4 py-4 text-center text-sm font-medium text-amber-950"
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
              <p className="text-xs text-slate-500">
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
              className="bg-indigo-600 hover:bg-indigo-700"
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
                <div className="p-4 bg-slate-50 rounded-lg">
                  <p className="font-medium">{editingUser.full_name}</p>
                  <p className="text-sm text-slate-500">{editingUser.email}</p>
                </div>
                <div className="space-y-2">
                  <Label>Role</Label>
                  {appRoleRank(editingUser.app_role) > appRoleRank(currentUser.app_role) ? (
                    <>
                      <p className="text-sm font-medium capitalize py-2 px-3 rounded-md border bg-slate-50">
                        {(editingUser.app_role || "student").replace(/_/g, " ")}
                      </p>
                      <p className="text-xs text-slate-500">
                        You cannot change this user&apos;s role — it is above your own level.
                      </p>
                    </>
                  ) : (
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
                  )}
                </div>
              </TabsContent>
              
              <TabsContent value="permissions" className="space-y-4 pt-4">
                <div className="space-y-1 mb-4">
                  <p className="text-sm font-medium">Dashboard Permissions</p>
                  <p className="text-xs text-slate-500">Control what sections this user can access in the dashboard</p>
                </div>
                
                <div className="space-y-3">
                  <div className="flex items-center justify-between py-2 border-b">
                    <div>
                      <p className="font-medium text-sm">View Statistics</p>
                      <p className="text-xs text-slate-500">Access to stats cards on dashboard</p>
                    </div>
                    <Switch
                      checked={editingUser.dashboard_permissions?.view_stats !== false}
                      onCheckedChange={() => togglePermission('view_stats')}
                    />
                  </div>
                  
                  <div className="flex items-center justify-between py-2 border-b">
                    <div>
                      <p className="font-medium text-sm">View Pending Requests</p>
                      <p className="text-xs text-slate-500">See pending requests section</p>
                    </div>
                    <Switch
                      checked={editingUser.dashboard_permissions?.view_pending_requests !== false}
                      onCheckedChange={() => togglePermission('view_pending_requests')}
                    />
                  </div>
                  
                  <div className="flex items-center justify-between py-2 border-b">
                    <div>
                      <p className="font-medium text-sm">View Fund Overview</p>
                      <p className="text-xs text-slate-500">See fund overview section</p>
                    </div>
                    <Switch
                      checked={editingUser.dashboard_permissions?.view_fund_overview !== false}
                      onCheckedChange={() => togglePermission('view_fund_overview')}
                    />
                  </div>
                  
                  <div className="flex items-center justify-between py-2 border-b">
                    <div>
                      <p className="font-medium text-sm">Access Review Queue</p>
                      <p className="text-xs text-slate-500">Navigate to review queue page</p>
                    </div>
                    <Switch
                      checked={editingUser.dashboard_permissions?.access_queue !== false}
                      onCheckedChange={() => togglePermission('access_queue')}
                    />
                  </div>
                  
                  <div className="flex items-center justify-between py-2 border-b">
                    <div>
                      <p className="font-medium text-sm">Access Funds Management</p>
                      <p className="text-xs text-slate-500">View and manage funds</p>
                    </div>
                    <Switch
                      checked={editingUser.dashboard_permissions?.access_funds !== false}
                      onCheckedChange={() => togglePermission('access_funds')}
                    />
                  </div>
                  
                  <div className="flex items-center justify-between py-2 border-b">
                    <div>
                      <p className="font-medium text-sm">Access Reports</p>
                      <p className="text-xs text-slate-500">View reporting dashboard</p>
                    </div>
                    <Switch
                      checked={editingUser.dashboard_permissions?.access_reports !== false}
                      onCheckedChange={() => togglePermission('access_reports')}
                    />
                  </div>
                  
                  <div className="flex items-center justify-between py-2 border-b">
                    <div>
                      <p className="font-medium text-sm">Access Routing Rules</p>
                      <p className="text-xs text-slate-500">Configure fund routing</p>
                    </div>
                    <Switch
                      checked={editingUser.dashboard_permissions?.access_rules === true}
                      onCheckedChange={() => togglePermission('access_rules')}
                    />
                  </div>
                  
                  <div className="flex items-center justify-between py-2 border-b">
                    <div>
                      <p className="font-medium text-sm">Access User Management</p>
                      <p className="text-xs text-slate-500">Manage users and roles</p>
                    </div>
                    <Switch
                      checked={editingUser.dashboard_permissions?.access_users === true}
                      onCheckedChange={() => togglePermission('access_users')}
                    />
                  </div>
                  
                  <div className="flex items-center justify-between py-2 border-b">
                    <div>
                      <p className="font-medium text-sm">Access Audit Log</p>
                      <p className="text-xs text-slate-500">View system audit trail</p>
                    </div>
                    <Switch
                      checked={editingUser.dashboard_permissions?.access_audit_log === true}
                      onCheckedChange={() => togglePermission('access_audit_log')}
                    />
                  </div>
                  
                  <div className="flex items-center justify-between py-2">
                    <div>
                      <p className="font-medium text-sm">Access Settings</p>
                      <p className="text-xs text-slate-500">Modify system settings</p>
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
              className="bg-indigo-600 hover:bg-indigo-700"
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