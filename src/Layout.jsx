import React, { useState, useEffect } from "react";
import { Link, useNavigate } from "react-router-dom";
import { createPageUrl } from "./utils";
import { api } from "@/api/supabaseApi";
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
  Bell
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
import NotificationBell from "@/components/notifications/NotificationBell";

export default function Layout({ children, currentPageName }) {
  const [user, setUser] = useState(null);
  const [loading, setLoading] = useState(true);
  const [sidebarOpen, setSidebarOpen] = useState(false);
  const navigate = useNavigate();

  useEffect(() => {
    loadUser();
  }, []);

  const loadUser = async () => {
    try {
      const currentUser = await api.auth.me();
      setUser(currentUser);
    } catch (error) {
      console.error("Error loading user:", error);
      // Redirect to PublicHome if not authenticated (unless already there)
      if (currentPageName !== "PublicHome" && currentPageName !== "SuperAdminDashboard") {
        navigate(createPageUrl("PublicHome"));
      }
    } finally {
      setLoading(false);
    }
  };

  const handleLogout = () => {
    api.auth.logout();
  };

  const userRole = user?.app_role || "student";
  const isStaff = ["reviewer", "approver", "advisor", "fund_manager", "admin"].includes(userRole);
  const isAdvisor = userRole === "advisor";
  const isAdmin = userRole === "admin";
  const isFundManager = userRole === "fund_manager" || isAdmin;
  
  // Get dashboard permissions
  const permissions = user?.dashboard_permissions || {};

  const studentNavItems = [
    { name: "Apply for Fund", icon: PlusCircle, page: "Apply" },
    { name: "My Requests", icon: FileText, page: "MyRequests" },
  ];

  const advisorNavItems = [
    { name: "My Assigned Applications", icon: FileText, page: "AdvisorQueue" },
  ];

  const staffNavItems = [
    { name: "Dashboard", icon: Home, page: "Home" },
    ...(permissions.access_queue !== false ? [{ name: "Review Queue", icon: ClipboardList, page: "Queue" }] : []),
    ...(permissions.access_funds !== false ? [{ name: "Funds", icon: Wallet, page: "Funds" }] : []),
    ...(permissions.access_reports !== false ? [{ name: "Reports", icon: BarChart3, page: "Reports" }] : []),
    ...((isFundManager || permissions.access_rules) ? [{ name: "Routing Rules", icon: Settings, page: "Rules" }] : []),
    ...((isAdmin || permissions.access_users) ? [{ name: "Users", icon: Users, page: "Users" }] : []),
    ...((isAdmin || permissions.access_audit_log) ? [{ name: "Audit Log", icon: FileSearch, page: "AuditLog" }] : []),
    ...((isAdmin || permissions.access_settings) ? [{ name: "Settings", icon: Settings, page: "Settings" }] : []),
  ];

  // Advisors with individual assignments get simplified nav, other staff get full sidebar
  const navItems = (isStaff && !isAdvisor) ? staffNavItems : (isAdvisor ? advisorNavItems : studentNavItems);

  // PublicHome and SuperAdminDashboard don't need layout
  if (currentPageName === "PublicHome" || currentPageName === "SuperAdminDashboard") {
    return children;
  }

  if (loading) {
    return (
      <div className="min-h-screen bg-slate-50 flex items-center justify-center">
        <div className="animate-pulse flex flex-col items-center gap-4">
          <div className="w-12 h-12 bg-indigo-200 rounded-full"></div>
          <div className="h-4 w-32 bg-slate-200 rounded"></div>
        </div>
      </div>
    );
  }

  // Student and Advisor layout - top navigation only
  if (!isStaff || isAdvisor) {
    return (
      <div className="min-h-screen bg-gradient-to-br from-slate-50 via-white to-indigo-50/30">
        {/* Top Navigation */}
        <header className="fixed top-0 left-0 right-0 z-50 bg-white/80 backdrop-blur-xl border-b border-slate-200/50">
          <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
            <div className="flex items-center justify-between h-16">
              {/* Logo */}
              <Link to={createPageUrl(isAdvisor ? "AdvisorQueue" : "Apply")} className="flex items-center gap-3">
                <div className="w-9 h-9 bg-gradient-to-br from-indigo-600 to-violet-600 rounded-lg flex items-center justify-center shadow-lg shadow-indigo-500/20">
                  <GraduationCap className="w-5 h-5 text-white" />
                </div>
                <span className="font-bold text-slate-800 text-lg hidden sm:block">Student Funds</span>
              </Link>

              {/* Main Navigation */}
              <nav className="hidden md:flex items-center gap-1">
                {isAdvisor ? (
                  <Link to={createPageUrl("AdvisorQueue")}>
                    <Button
                      variant="ghost"
                      className={`${
                        currentPageName === "AdvisorQueue" || currentPageName === "AdvisorRequestDetail"
                          ? "bg-indigo-50 text-indigo-700"
                          : "text-slate-600 hover:text-slate-900"
                      }`}
                    >
                      <FileText className="w-4 h-4 mr-2" />
                      My Assigned Applications
                    </Button>
                  </Link>
                ) : (
                  <>
                    <Link to={createPageUrl("Apply")}>
                      <Button
                        variant="ghost"
                        className={`${
                          currentPageName === "Apply"
                            ? "bg-indigo-50 text-indigo-700"
                            : "text-slate-600 hover:text-slate-900"
                        }`}
                      >
                        <PlusCircle className="w-4 h-4 mr-2" />
                        Apply
                      </Button>
                    </Link>
                    <Link to={createPageUrl("MyRequests")}>
                      <Button
                        variant="ghost"
                        className={`${
                          currentPageName === "MyRequests" || currentPageName === "RequestDetail"
                            ? "bg-indigo-50 text-indigo-700"
                            : "text-slate-600 hover:text-slate-900"
                        }`}
                      >
                        <FileText className="w-4 h-4 mr-2" />
                        My Requests
                      </Button>
                    </Link>
                  </>
                )}
              </nav>

              {/* Right Side - Notifications + Profile */}
              <div className="flex items-center gap-2">
                {user && <NotificationBell user={user} />}
                <DropdownMenu>
                  <DropdownMenuTrigger asChild>
                    <Button variant="ghost" className="h-auto p-2 hover:bg-slate-100 rounded-xl">
                      <Avatar className="h-8 w-8 border-2 border-indigo-100">
                        <AvatarFallback className="bg-gradient-to-br from-indigo-100 to-violet-100 text-indigo-700 font-semibold text-sm">
                          {user?.full_name?.split(" ").map(n => n[0]).join("").toUpperCase() || "U"}
                        </AvatarFallback>
                      </Avatar>
                    </Button>
                  </DropdownMenuTrigger>
                  <DropdownMenuContent align="end" className="w-56">
                    <div className="px-3 py-2">
                      <p className="font-medium text-sm">{user?.full_name}</p>
                      <p className="text-xs text-slate-500">{user?.email}</p>
                    </div>
                    <DropdownMenuSeparator />
                    {isAdvisor ? (
                      <DropdownMenuItem asChild className="md:hidden">
                        <Link to={createPageUrl("AdvisorQueue")} className="cursor-pointer">
                          <FileText className="w-4 h-4 mr-2" />
                          My Assigned Applications
                        </Link>
                      </DropdownMenuItem>
                    ) : (
                      <>
                        <DropdownMenuItem asChild className="md:hidden">
                          <Link to={createPageUrl("Apply")} className="cursor-pointer">
                            <PlusCircle className="w-4 h-4 mr-2" />
                            Apply
                          </Link>
                        </DropdownMenuItem>
                        <DropdownMenuItem asChild className="md:hidden">
                          <Link to={createPageUrl("MyRequests")} className="cursor-pointer">
                            <FileText className="w-4 h-4 mr-2" />
                            My Requests
                          </Link>
                        </DropdownMenuItem>
                      </>
                    )}
                    <DropdownMenuSeparator className="md:hidden" />
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
                    <DropdownMenuItem onClick={handleLogout} className="text-red-600 cursor-pointer">
                      <LogOut className="w-4 h-4 mr-2" />
                      Sign Out
                    </DropdownMenuItem>
                  </DropdownMenuContent>
                </DropdownMenu>
              </div>
            </div>
          </div>
        </header>

        {/* Main Content */}
        <main className="min-h-screen pt-16">
          <div className="p-4 md:p-8 max-w-7xl mx-auto">
            {children}
          </div>
        </main>
      </div>
    );
  }

  // Staff layout - sidebar navigation
  return (
    <div className="min-h-screen bg-gradient-to-br from-slate-50 via-white to-indigo-50/30">
      {/* Mobile Header */}
      <header className="lg:hidden fixed top-0 left-0 right-0 z-50 bg-white/80 backdrop-blur-xl border-b border-slate-200/50 px-4 py-3">
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-3">
            <button
              onClick={() => setSidebarOpen(!sidebarOpen)}
              className="p-2 rounded-xl hover:bg-slate-100 transition-colors"
            >
              {sidebarOpen ? <X className="w-5 h-5" /> : <Menu className="w-5 h-5" />}
            </button>
            <div className="flex items-center gap-2">
              <div className="w-8 h-8 bg-gradient-to-br from-indigo-600 to-violet-600 rounded-lg flex items-center justify-center">
                <GraduationCap className="w-5 h-5 text-white" />
              </div>
              <span className="font-semibold text-slate-800">Student Funds</span>
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
          className="lg:hidden fixed inset-0 bg-black/20 backdrop-blur-sm z-40"
          onClick={() => setSidebarOpen(false)}
        />
      )}

      {/* Sidebar */}
      <aside
        className={`fixed top-0 left-0 h-full w-72 bg-white/80 backdrop-blur-xl border-r border-slate-200/50 z-50 transform transition-transform duration-300 ease-out lg:translate-x-0 ${
          sidebarOpen ? "translate-x-0" : "-translate-x-full"
        }`}
      >
        <div className="flex flex-col h-full">
          {/* Logo */}
          <div className="p-6 border-b border-slate-100">
            <div className="flex items-center gap-3">
              <div className="w-10 h-10 bg-gradient-to-br from-indigo-600 to-violet-600 rounded-xl flex items-center justify-center shadow-lg shadow-indigo-500/20">
                <GraduationCap className="w-6 h-6 text-white" />
              </div>
              <div>
                <h1 className="font-bold text-slate-800 text-lg">Student Funds</h1>
                <p className="text-xs text-slate-500 capitalize">{userRole} Portal</p>
              </div>
            </div>
          </div>

          {/* Navigation */}
          <nav className="flex-1 p-4 space-y-1 overflow-y-auto">
            {navItems.map((item) => {
              const isActive = currentPageName === item.page;
              return (
                <Link
                  key={item.page}
                  to={createPageUrl(item.page)}
                  onClick={() => setSidebarOpen(false)}
                  className={`flex items-center gap-3 px-4 py-3 rounded-xl transition-all duration-200 group ${
                    isActive
                      ? "bg-gradient-to-r from-indigo-600 to-violet-600 text-white shadow-lg shadow-indigo-500/25"
                      : "text-slate-600 hover:bg-slate-100 hover:text-slate-900"
                  }`}
                >
                  <item.icon className={`w-5 h-5 ${isActive ? "text-white" : "text-slate-400 group-hover:text-indigo-600"}`} />
                  <span className="font-medium">{item.name}</span>
                </Link>
              );
            })}
          </nav>

          {/* User Section */}
          <div className="p-4 border-t border-slate-100 space-y-3">
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
      <main className="lg:ml-72 min-h-screen pt-16 lg:pt-0">
        <div className="p-4 md:p-8 max-w-7xl mx-auto">
          {children}
        </div>
      </main>
    </div>
  );
}

function UserDropdown({ user, handleLogout, fullWidth }) {
  return (
    <DropdownMenu>
      <DropdownMenuTrigger asChild>
        <Button
          variant="ghost"
          className={`${fullWidth ? "w-full justify-start" : ""} h-auto p-2 hover:bg-slate-100 rounded-xl`}
        >
          <div className="flex items-center gap-3">
            <Avatar className="h-9 w-9 border-2 border-indigo-100">
              <AvatarFallback className="bg-gradient-to-br from-indigo-100 to-violet-100 text-indigo-700 font-semibold text-sm">
                {user?.full_name?.split(" ").map(n => n[0]).join("").toUpperCase() || "U"}
              </AvatarFallback>
            </Avatar>
            {fullWidth && (
              <div className="flex-1 text-left">
                <p className="font-medium text-slate-800 text-sm">{user?.full_name || "User"}</p>
                <p className="text-xs text-slate-500 capitalize">{user?.app_role || "student"}</p>
              </div>
            )}
            <ChevronDown className="w-4 h-4 text-slate-400" />
          </div>
        </Button>
      </DropdownMenuTrigger>
      <DropdownMenuContent align="end" className="w-56">
        <div className="px-3 py-2">
          <p className="font-medium text-sm">{user?.full_name}</p>
          <p className="text-xs text-slate-500">{user?.email}</p>
        </div>
        <DropdownMenuSeparator />
        <DropdownMenuItem asChild>
          <Link to={createPageUrl("Profile")} className="cursor-pointer">
            <UserIcon className="w-4 h-4 mr-2" />
            Profile
          </Link>
        </DropdownMenuItem>
        <DropdownMenuSeparator />
        <DropdownMenuItem onClick={handleLogout} className="text-red-600 cursor-pointer">
          <LogOut className="w-4 h-4 mr-2" />
          Sign Out
        </DropdownMenuItem>
      </DropdownMenuContent>
    </DropdownMenu>
  );
}