import React, { useState, type ReactNode } from "react";
import { Link, useNavigate } from "react-router-dom";
import { createPageUrl, isStaffAppRole } from "./utils";
import { api } from "@/api/supabaseApi";
import { appVersion } from "@/appVersion";
import { useQuery } from "@tanstack/react-query";
import {
  GraduationCap,
  FileText,
  Users,
  Wallet,
  BarChart3,
  Settings,
  LogOut,
  Menu,
  X,
  ClipboardList,
  PlusCircle,
  ChevronDown,
  User as UserIcon,
  Home,
  FileSearch,
  Bell,
  Moon,
  Sun
} from "lucide-react";
import { Button } from "@/components/ui/button";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import { Avatar, AvatarFallback } from "@/components/ui/avatar";
import { Switch } from "@/components/ui/switch";
import NotificationBell from "@/components/notifications/NotificationBell";
import { useTheme } from "@/lib/ThemeContext";

interface LayoutProps {
  children: ReactNode;
  currentPageName: string;
}

/** Sidebar highlight: match section roots to their detail/sub-pages */
function isSidebarNavActive(itemPage: string, currentPageName: string): boolean {
  switch (itemPage) {
    case "MyRequests":
      return currentPageName === "MyRequests" || currentPageName === "RequestDetail";
    case "AdvisorQueue":
      return currentPageName === "AdvisorQueue" || currentPageName === "AdvisorRequestDetail";
    case "Queue":
      return currentPageName === "Queue" || currentPageName === "ReviewRequest";
    case "Funds":
      return currentPageName === "Funds" || currentPageName === "FundDetail" || currentPageName === "CreateFund";
    default:
      return currentPageName === itemPage;
  }
}

export default function Layout({ children, currentPageName }: LayoutProps) {
  const [sidebarOpen, setSidebarOpen] = useState(false);
  const navigate = useNavigate();

  const isPublic = currentPageName === "PublicHome";

  const {
    data: user,
    isLoading: loading,
  } = useQuery<any | null>({
    queryKey: ["me"],
    enabled: !isPublic,
    queryFn: async () => {
      try {
        return await api.auth.me();
      } catch (error) {
        console.error("Error loading user:", error);
        if (currentPageName !== "PublicHome" && currentPageName !== "SuperAdminDashboard") {
          navigate(createPageUrl("PublicHome"));
        }
        return null;
      }
    },
  });

  const handleLogout = () => {
    api.auth.logout();
  };

  const userRole = user?.app_role || "student";
  const isStaff = isStaffAppRole(user?.app_role);
  const isAdvisor = userRole === "advisor";
  const isAdmin = userRole === "admin" || userRole === "super_admin";
  const isFundManager = userRole === "fund_manager" || isAdmin;
  const permissions = user?.dashboard_permissions || {};
  const isReviewer = userRole === "reviewer";
  const showFundsInNav = !isReviewer && permissions.access_funds !== false;

  const { data: latestAccessRequest } = useQuery<any | null>({
    queryKey: ["latestAccessRequest", user?.email],
    enabled: !!user?.email && !user?.organization_id,
    queryFn: async () => {
      if (!user?.email) return null;
      const reqs = await api.entities.AccessRequest.filter({ email: user.email }, "-created_date", 1);
      return reqs?.[0] || null;
    },
  });

  const organizationIdForHeader =
    user?.organization_id ?? latestAccessRequest?.organization_id ?? null;

  const { data: activeOrganization } = useQuery<any | null>({
    queryKey: ["activeOrganization", organizationIdForHeader],
    enabled: !!organizationIdForHeader,
    queryFn: async () => {
      const orgs = await api.entities.Organization.filter({ id: organizationIdForHeader }, undefined, 1);
      return orgs?.[0] || null;
    },
  });

  const orgDisplayName = activeOrganization?.name || "Student Funds";

  const studentNavItems = [
    { name: "My Requests", icon: FileText, page: "MyRequests" },
    { name: "Apply for Fund", icon: PlusCircle, page: "Apply" },
  ];

  const staffNavItems = [
    { name: "Dashboard", icon: Home, page: "Home" },
    ...(isAdvisor ? [{ name: "Assigned Applications", icon: FileText, page: "AdvisorQueue" }] : []),
    ...(permissions.access_queue !== false ? [{ name: "Review Queue", icon: ClipboardList, page: "Queue" }] : []),
    ...(showFundsInNav ? [{ name: "Funds", icon: Wallet, page: "Funds" }] : []),
    ...(permissions.access_reports !== false ? [{ name: "Reports", icon: BarChart3, page: "Reports" }] : []),
    ...((isFundManager || permissions.access_rules) ? [{ name: "Routing Rules", icon: Settings, page: "Rules" }] : []),
    ...((isAdmin || userRole === "fund_manager" || permissions.access_users) ? [{ name: "Users", icon: Users, page: "Users" }] : []),
    ...((isAdmin || permissions.access_audit_log) ? [{ name: "Audit Log", icon: FileSearch, page: "AuditLog" }] : []),
    ...(userRole === "super_admin" ? [{ name: "Super Admin", icon: Settings, page: "SuperAdminDashboard" }] : []),
    ...((isAdmin || permissions.access_settings) ? [{ name: "Settings", icon: Settings, page: "Settings" }] : []),
  ];

  const navItems = isStaff ? staffNavItems : studentNavItems;
  const sidebarLogoHref = createPageUrl(navItems[0]?.page ?? "Home");

  // PublicHome doesn't need layout
  if (isPublic) {
    return children;
  }

  if (loading) {
    return (
      <div className="min-h-screen bg-slate-50 dark:bg-slate-950 flex items-center justify-center">
        <div className="animate-pulse flex flex-col items-center gap-4">
          <div className="w-12 h-12 bg-indigo-200 dark:bg-indigo-900 rounded-full"></div>
          <div className="h-4 w-32 bg-slate-200 dark:bg-slate-800 rounded"></div>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-linear-to-br from-slate-50 via-white to-indigo-50/30 dark:from-slate-950 dark:via-slate-950 dark:to-indigo-950/30">
      {/* Mobile Header */}
      <header className="lg:hidden fixed top-0 left-0 right-0 z-50 bg-white/80 dark:bg-slate-900/80 backdrop-blur-xl border-b border-slate-200/50 dark:border-slate-800/50 px-4 py-3">
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-3">
            <button
              onClick={() => setSidebarOpen(!sidebarOpen)}
              className="p-2 rounded-xl hover:bg-slate-100 dark:hover:bg-slate-800 text-slate-700 dark:text-slate-200 transition-colors"
            >
              {sidebarOpen ? <X className="w-5 h-5" /> : <Menu className="w-5 h-5" />}
            </button>
            <div className="flex items-center gap-2">
              <div className="w-8 h-8 rounded-lg flex items-center justify-center overflow-hidden bg-linear-to-br from-indigo-600 to-violet-600">
                {activeOrganization?.logo ? (
                  <img
                    src={activeOrganization.logo}
                    alt={`${activeOrganization?.name || "Organization"} logo`}
                    className="w-full h-full object-cover"
                  />
                ) : (
                  <GraduationCap className="w-5 h-5 text-white" />
                )}
              </div>
              <div className="min-w-0">
                <div className="font-semibold text-slate-800 dark:text-slate-100 leading-tight truncate max-w-[240px]">
                  {orgDisplayName}
                </div>
              </div>
            </div>
          </div>
          <div className="flex items-center gap-2">
            {user && <NotificationBell user={user} />}
            <UserDropdown user={user} handleLogout={handleLogout} />
          </div>
        </div>
      </header>

      {/* Mobile Sidebar Overlay */}
      {sidebarOpen && (
        <div
          className="lg:hidden fixed inset-0 bg-black/20 dark:bg-black/50 backdrop-blur-xs z-40"
          onClick={() => setSidebarOpen(false)}
        />
      )}

      {/* Sidebar */}
      <aside
        className={`fixed top-0 left-0 h-full w-72 bg-white/80 dark:bg-slate-900/80 backdrop-blur-xl border-r border-slate-200/50 dark:border-slate-800/50 z-50 transform transition-transform duration-300 ease-out lg:translate-x-0 ${
          sidebarOpen ? "translate-x-0" : "-translate-x-full"
        }`}
      >
        <div className="flex flex-col h-full">
          {/* Logo */}
          <div className="p-6 border-b border-slate-100 dark:border-slate-800">
            <Link to={sidebarLogoHref} className="flex items-center gap-3 rounded-xl outline-offset-2 hover:opacity-90 transition-opacity">
              <div className="w-10 h-10 rounded-xl flex items-center justify-center shadow-lg shadow-indigo-500/20 overflow-hidden bg-linear-to-br from-indigo-600 to-violet-600">
                {activeOrganization?.logo ? (
                  <img
                    src={activeOrganization.logo}
                    alt={`${activeOrganization?.name || "Organization"} logo`}
                    className="w-full h-full object-cover"
                  />
                ) : (
                  <GraduationCap className="w-6 h-6 text-white" />
                )}
              </div>
              <div>
                <h1 className="font-bold text-slate-800 dark:text-slate-100 text-lg truncate max-w-[180px]">
                  {orgDisplayName}
                </h1>
                <p className="text-xs text-slate-500 dark:text-slate-400">
                  <span className="block capitalize">{userRole.replace(/_/g, " ")} Portal</span>
                </p>
              </div>
            </Link>
          </div>

          {/* Navigation */}
          <nav className="flex-1 p-4 space-y-1 overflow-y-auto">
            {navItems.map((item) => {
              const isActive = isSidebarNavActive(item.page, currentPageName);
              return (
                <Link
                  key={item.page}
                  to={createPageUrl(item.page)}
                  onClick={() => setSidebarOpen(false)}
                  className={`flex items-center gap-3 px-4 py-3 rounded-xl transition-all duration-200 group ${
                    isActive
                      ? "bg-linear-to-r from-indigo-600 to-violet-600 text-white shadow-lg shadow-indigo-500/25"
                      : "text-slate-600 dark:text-slate-300 hover:bg-slate-100 dark:hover:bg-slate-800 hover:text-slate-900 dark:hover:text-white"
                  }`}
                >
                  <item.icon className={`w-5 h-5 ${isActive ? "text-white" : "text-slate-400 dark:text-slate-500 group-hover:text-indigo-600 dark:group-hover:text-indigo-400"}`} />
                  <span className="font-medium">{item.name}</span>
                </Link>
              );
            })}
          </nav>

          {/* User Section */}
          <div className="p-4 border-t border-slate-100 dark:border-slate-800 space-y-3">
            {user && (
              <div className="hidden lg:flex justify-end">
                <NotificationBell user={user} />
              </div>
            )}
            <div className="hidden lg:block">
              <UserDropdown user={user} handleLogout={handleLogout} fullWidth />
            </div>
          </div>
        </div>
      </aside>

      {/* Main Content */}
      <main className="lg:ml-72 min-h-screen pt-16 lg:pt-0 text-slate-900 dark:text-slate-100">
        <div className="p-4 md:p-8 max-w-7xl mx-auto">
          {children}
        </div>
      </main>
    </div>
  );
}

interface UserDropdownProps {
  user: any;
  handleLogout: () => void;
  fullWidth?: boolean;
}

function UserDropdown({ user, handleLogout, fullWidth }: UserDropdownProps) {
  const { theme, toggleTheme } = useTheme();
  const isDark = theme === "dark";

  return (
    <DropdownMenu>
      <DropdownMenuTrigger asChild>
        <Button
          variant="ghost"
          className={`${fullWidth ? "w-full justify-start" : ""} h-auto p-2 hover:bg-slate-100 dark:hover:bg-slate-800 rounded-xl`}
        >
          <div className="flex items-center gap-3">
            <Avatar className="h-9 w-9 border-2 border-indigo-100 dark:border-indigo-900">
              <AvatarFallback className="bg-linear-to-br from-indigo-100 to-violet-100 dark:from-indigo-900 dark:to-violet-900 text-indigo-700 dark:text-indigo-200 font-semibold text-sm">
                {user?.full_name?.split(" ").map(n => n[0]).join("").toUpperCase() || "U"}
              </AvatarFallback>
            </Avatar>
            {fullWidth && (
              <div className="flex-1 text-left">
                <p className="font-medium text-slate-800 dark:text-slate-100 text-sm">{user?.full_name || "User"}</p>
                <p className="text-xs text-slate-500 dark:text-slate-400 capitalize">{user?.app_role || "student"}</p>
              </div>
            )}
            <ChevronDown className="w-4 h-4 text-slate-400" />
          </div>
        </Button>
      </DropdownMenuTrigger>
      <DropdownMenuContent align="end" className="w-56">
        <div className="px-3 py-2">
          <p className="font-medium text-sm">{user?.full_name}</p>
          <p className="text-xs text-slate-500 dark:text-slate-400">{user?.email}</p>
        </div>
        <div className="px-3 py-2">
          <div className="text-xs font-medium text-slate-500 dark:text-slate-400">Fund Journey v{appVersion}</div>
        </div>
        <DropdownMenuSeparator />
        <DropdownMenuItem asChild>
          <Link to={createPageUrl("Notifications")} className="cursor-pointer">
            <Bell className="w-4 h-4 mr-2" />
            Notifications
          </Link>
        </DropdownMenuItem>
        <DropdownMenuItem asChild>
          <Link to={createPageUrl("Profile")} className="cursor-pointer">
            <UserIcon className="w-4 h-4 mr-2" />
            Profile
          </Link>
        </DropdownMenuItem>
        <DropdownMenuSeparator />
        <div
          className="flex items-center justify-between px-2 py-1.5 text-sm select-none"
          onClick={(e) => e.preventDefault()}
        >
          <div className="flex items-center">
            {isDark ? (
              <Moon className="w-4 h-4 mr-2" />
            ) : (
              <Sun className="w-4 h-4 mr-2" />
            )}
            <span>Dark mode</span>
          </div>
          <Switch
            checked={isDark}
            onCheckedChange={toggleTheme}
            aria-label="Toggle dark mode"
          />
        </div>
        <DropdownMenuSeparator />
        <DropdownMenuItem onClick={handleLogout} className="text-red-600 cursor-pointer">
          <LogOut className="w-4 h-4 mr-2" />
          Sign Out
        </DropdownMenuItem>
      </DropdownMenuContent>
    </DropdownMenu>
  );
}