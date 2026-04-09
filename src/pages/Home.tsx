import React, { useState, useEffect } from "react";
import { Link, useNavigate } from "react-router-dom";
import { createPageUrl, isStaffAppRole } from "@/utils";
import { api } from "@/api/supabaseApi";
import { useQuery } from "@tanstack/react-query";
import PageHeader from "@/components/shared/PageHeader";
import StatCard from "@/components/shared/StatCard";
import StatusBadge from "@/components/shared/StatusBadge";
import LoadingSpinner from "@/components/shared/LoadingSpinner";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import {
  FileText,
  Wallet,
  Clock,
  CheckCircle,
  PlusCircle,
  ArrowRight,
  TrendingUp,
  AlertCircle
} from "lucide-react";
import { format } from "date-fns";

export default function Home() {
  const [user, setUser] = useState(null);
  const navigate = useNavigate();

  useEffect(() => {
    loadUser();
  }, []);

  const loadUser = async () => {
    const currentUser = await api.auth.me();
    setUser(currentUser);
    
    if (!isStaffAppRole(currentUser?.app_role)) {
      navigate(createPageUrl("MyRequests"));
    }
  };

  const isStaff = isStaffAppRole(user?.app_role);

  if (!user) {
    return (
      <div className="flex items-center justify-center min-h-[60vh]">
        <LoadingSpinner size="lg" />
      </div>
    );
  }

  return isStaff ? <StaffDashboard user={user} /> : null;
}



function StaffDashboard({ user }) {
  const permissions = user?.dashboard_permissions || {};
  
  const { data: allRequests = [], isLoading } = useQuery({
    queryKey: ["allRequests", user?.organization_id],
    queryFn: () => api.entities.FundRequest.filter({ organization_id: user.organization_id }, "-created_date"),
    enabled: !!user?.organization_id && permissions.view_pending_requests !== false,
  });

  const { data: funds = [] } = useQuery({
    queryKey: ["allFunds", user?.organization_id],
    queryFn: () => api.entities.Fund.filter({ organization_id: user.organization_id }),
    enabled: !!user?.organization_id && permissions.view_fund_overview !== false,
  });

  const { data: disbursements = [] } = useQuery({
    queryKey: ["disbursements", user?.organization_id],
    queryFn: () => api.entities.Disbursement.filter({ organization_id: user.organization_id }),
    enabled: !!user?.organization_id && permissions.view_stats !== false,
  });

  const stats = {
    pendingReview: allRequests.filter(r => ["Submitted", "In Review"].includes(r.status)).length,
    approved: allRequests.filter(r => r.status === "Approved").length,
    totalDisbursed: disbursements.reduce((sum, d) => sum + (d.amount_paid || 0), 0),
    activeFunds: funds.filter(f => f.status === "active").length,
  };

  const pendingRequests = allRequests
    .filter(r => ["Submitted", "In Review", "Needs Info"].includes(r.status))
    .slice(0, 5);

  return (
    <div className="space-y-8">
      <PageHeader
        title={`Welcome back, ${user.full_name?.split(" ")[0] || "Staff"}`}
        description="Overview of fund requests and disbursements"
        actions={
          <Button asChild className="bg-linear-to-r from-indigo-600 to-violet-600 hover:from-indigo-700 hover:to-violet-700">
            <Link to={createPageUrl("Queue")}>
              View Queue <ArrowRight className="w-4 h-4 ml-2" />
            </Link>
          </Button>
        }
      />

      {/* Stats Grid */}
      {permissions.view_stats !== false && (
        <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
          <StatCard
            title="Pending Review"
            value={stats.pendingReview}
            icon={Clock}
            color="amber"
          />
          <StatCard
            title="Approved"
            value={stats.approved}
            icon={CheckCircle}
            color="emerald"
          />
          <StatCard
            title="Total Disbursed"
            value={`$${stats.totalDisbursed.toLocaleString()}`}
            icon={TrendingUp}
            color="violet"
          />
          <StatCard
            title="Active Funds"
            value={stats.activeFunds}
            icon={Wallet}
            color="blue"
          />
        </div>
      )}

      <div className="grid lg:grid-cols-3 gap-6">
        {/* Pending Requests */}
        {permissions.view_pending_requests !== false && (
          <Card className="lg:col-span-2 bg-white/70 backdrop-blur-xs border-slate-200/50">
          <CardHeader className="flex flex-row items-center justify-between pb-2">
            <CardTitle className="text-lg font-semibold">Requests Needing Attention</CardTitle>
            <Button variant="ghost" size="sm" asChild>
              <Link to={createPageUrl("Queue")} className="text-indigo-600">
                View All <ArrowRight className="w-4 h-4 ml-1" />
              </Link>
            </Button>
          </CardHeader>
          <CardContent>
            {isLoading ? (
              <LoadingSpinner className="py-8" />
            ) : pendingRequests.length === 0 ? (
              <div className="text-center py-8 text-slate-500">
                <CheckCircle className="w-10 h-10 mx-auto mb-2 text-emerald-300" />
                <p>All caught up!</p>
                <p className="text-sm">No pending requests</p>
              </div>
            ) : (
              <div className="space-y-3">
                {pendingRequests.map((request) => (
                  <Link
                    key={request.id}
                    to={createPageUrl(`ReviewRequest?id=${request.id}`)}
                    className="flex items-center justify-between p-3 rounded-xl hover:bg-slate-50 transition-colors group"
                  >
                    <div className="flex-1 min-w-0">
                      <p className="font-medium text-slate-800 truncate group-hover:text-indigo-600">
                        {request.student_full_name}
                      </p>
                      <p className="text-sm text-slate-500">
                        {request.fund_name} • ${request.requested_amount?.toLocaleString()}
                      </p>
                    </div>
                    <div className="flex items-center gap-3">
                      <StatusBadge status={request.status} />
                      <ArrowRight className="w-4 h-4 text-slate-300 group-hover:text-indigo-600" />
                    </div>
                  </Link>
                ))}
              </div>
            )}
          </CardContent>
        </Card>
        )}

        {/* Fund Overview */}
        {permissions.view_fund_overview !== false && (
          <Card className="bg-white/70 backdrop-blur-xs border-slate-200/50">
          <CardHeader className="flex flex-row items-center justify-between pb-2">
            <CardTitle className="text-lg font-semibold">Fund Overview</CardTitle>
            {user.app_role !== "reviewer" && (
              <Button variant="ghost" size="sm" asChild>
                <Link to={createPageUrl("Funds")} className="text-indigo-600">
                  Manage
                </Link>
              </Button>
            )}
          </CardHeader>
          <CardContent>
            {funds.length === 0 ? (
              <div className="text-center py-8 text-slate-500">
                <Wallet className="w-10 h-10 mx-auto mb-2 text-slate-300" />
                <p>No funds created</p>
              </div>
            ) : (
              <div className="space-y-3">
                {funds.slice(0, 5).map((fund) => (
                  <div
                    key={fund.id}
                    className="p-3 rounded-xl border border-slate-100"
                  >
                    <div className="flex items-center justify-between mb-2">
                      <p className="font-medium text-slate-800">{fund.fund_name}</p>
                      <StatusBadge status={fund.status} />
                    </div>
                    <div className="flex items-center justify-between text-sm">
                      <span className="text-slate-500">Budget</span>
                      <span className="font-medium">${fund.total_budget?.toLocaleString()}</span>
                    </div>
                    {fund.remaining_budget !== undefined && (
                      <div className="mt-2">
                        <div className="h-2 bg-slate-100 rounded-full overflow-hidden">
                          <div
                            className="h-full bg-linear-to-r from-indigo-500 to-violet-500 rounded-full"
                            style={{
                              width: `${Math.min(100, ((fund.remaining_budget || 0) / fund.total_budget) * 100)}%`,
                            }}
                          />
                        </div>
                        <p className="text-xs text-slate-400 mt-1">
                          ${fund.remaining_budget?.toLocaleString()} remaining
                        </p>
                      </div>
                    )}
                  </div>
                ))}
              </div>
            )}
          </CardContent>
        </Card>
        )}
      </div>
    </div>
  );
}