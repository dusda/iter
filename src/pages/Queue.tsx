import React, { useState, useEffect, useRef } from "react";
import { Link, useSearchParams } from "react-router-dom";
import { createPageUrl } from "@/utils";
import { api } from "@/api/supabaseApi";
import { useQuery } from "@tanstack/react-query";
import PageHeader from "@/components/shared/PageHeader";
import StatusBadge from "@/components/shared/StatusBadge";
import LoadingSpinner from "@/components/shared/LoadingSpinner";
import EmptyState from "@/components/shared/EmptyState";
import { Card, CardContent } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Badge } from "@/components/ui/badge";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import { Tabs, TabsList, TabsTrigger } from "@/components/ui/tabs";
import {
  ClipboardList,
  Search,
  Filter,
  ArrowRight,
  Calendar,
  DollarSign,
  User,
  Clock
} from "lucide-react";
import { format } from "date-fns";

/** Matches dashboard “pending” list — requests that may still need staff attention. */
const ORG_PENDING_STATUSES = ["Submitted", "In Review", "Needs Info"];

/**
 * Default tab: routing uses `role_reviewer` etc., never `role_super_admin`, and many funds have no `fund_owner_id`,
 * so role_queue can be empty for some roles. Org-wide pending aligns with the dashboard.
 * “All for My Funds” for elevated roles uses every fund in the org (fund_owner_id is often unset).
 */
function defaultQueueViewMode(appRole: string | undefined | null): string {
  if (appRole === "fund_manager" || appRole === "admin" || appRole === "super_admin") {
    return "all_org_pending";
  }
  return "role_queue";
}

export default function Queue() {
  const [searchParams] = useSearchParams();
  const appliedQueryDefaults = useRef(false);
  const [searchTerm, setSearchTerm] = useState("");
  const [viewModeUserPick, setViewModeUserPick] = useState<string | null>(null);
  const [statusFilter, setStatusFilter] = useState("all");
  const [fundFilter, setFundFilter] = useState("all");
  const [categoryFilter, setCategoryFilter] = useState("all");
  const [minAmount, setMinAmount] = useState("");
  const [maxAmount, setMaxAmount] = useState("");

  const { data: user, isLoading: userLoading } = useQuery({
    queryKey: ["me"],
    queryFn: () => api.auth.me(),
  });

  const { data: allRequests = [], isLoading } = useQuery({
    queryKey: ["fundRequests", user?.organization_id],
    enabled: !!user?.organization_id,
    queryFn: () =>
      api.entities.FundRequest.filter({ organization_id: user.organization_id }, "-created_date"),
  });

  const { data: funds = [] } = useQuery({
    queryKey: ["funds", user?.organization_id],
    enabled: !!user?.organization_id,
    queryFn: () =>
      api.entities.Fund.filter({ organization_id: user.organization_id }),
  });

  const { data: allReviews = [] } = useQuery({
    queryKey: ["reviews", user?.organization_id],
    enabled: !!user?.organization_id,
    queryFn: () =>
      api.entities.Review.filter({ organization_id: user.organization_id }),
  });

  const elevatedQueueAccess =
    !!user &&
    (user.app_role === "fund_manager" ||
      user.app_role === "admin" ||
      user.app_role === "super_admin");

  /** Non-elevated roles only get Role Queue — no need for a one-option tab strip */
  const showQueueTabs = elevatedQueueAccess;

  const queueViewMode =
    !user || !showQueueTabs
      ? "role_queue"
      : viewModeUserPick ?? defaultQueueViewMode(user.app_role);

  useEffect(() => {
    if (!user || appliedQueryDefaults.current) return;
    appliedQueryDefaults.current = true;
    if (!showQueueTabs) return;
    const view = searchParams.get("view");
    const status = searchParams.get("status");
    if (view === "my_funds" || view === "all_org_pending" || view === "role_queue") {
      setViewModeUserPick(view);
    }
    if (status && status !== "all") {
      setStatusFilter(status);
    }
  }, [user, showQueueTabs, searchParams]);

  // Calculate days since submission
  const getDaysSince = (date) => {
    if (!date) return 0;
    const diff = Date.now() - new Date(date).getTime();
    return Math.floor(diff / (1000 * 60 * 60 * 24));
  };

  // Filter requests based on view mode
  const getRequestsForView = () => {
    if (!user) return [];

    let requests = [...allRequests];

    if (queueViewMode === "all_org_pending") {
      requests = requests.filter((r) => ORG_PENDING_STATUSES.includes(r.status));
    } else if (queueViewMode === "role_queue") {
      // Role queue plus legacy rows where this user was named on the review (before per-user assignment was removed)
      const roleReviews = allReviews.filter(
        (r) =>
          r.decision === "Pending" &&
          (r.reviewer_user_id === `role_${user.app_role}` || r.reviewer_user_id === user.id)
      );
      const queueRequestIds = roleReviews.map(r => r.fund_request_id);
      requests = requests.filter(r => queueRequestIds.includes(r.id));
    } else if (queueViewMode === "my_funds") {
      const myFundIds = funds.map((f) => f.id);
      requests = requests.filter((r) => myFundIds.includes(r.fund_id));
    }

    return requests;
  };

  const requests = getRequestsForView();

  const filteredRequests = requests.filter((request) => {
    const matchesSearch =
      request.request_id?.toLowerCase().includes(searchTerm.toLowerCase()) ||
      request.student_full_name?.toLowerCase().includes(searchTerm.toLowerCase()) ||
      request.fund_name?.toLowerCase().includes(searchTerm.toLowerCase()) ||
      request.intended_use_category?.toLowerCase().includes(searchTerm.toLowerCase());
    
    const matchesStatus = statusFilter === "all" || request.status === statusFilter;
    const matchesFund = fundFilter === "all" || request.fund_id === fundFilter;
    const matchesCategory = categoryFilter === "all" || request.intended_use_category === categoryFilter;
    
    const amount = request.requested_amount || 0;
    const matchesMinAmount = !minAmount || amount >= parseFloat(minAmount);
    const matchesMaxAmount = !maxAmount || amount <= parseFloat(maxAmount);
    
    return matchesSearch && matchesStatus && matchesFund && matchesCategory && matchesMinAmount && matchesMaxAmount;
  });

  const categories = ["Tuition/Fees", "Books/Supplies", "Housing", "Food", "Transportation", "Medical", "Technology", "Other"];

  if (userLoading || !user) {
    return (
      <div className="flex items-center justify-center min-h-[60vh]">
        <LoadingSpinner size="lg" />
      </div>
    );
  }

  return (
    <div className="space-y-6">
      <PageHeader
        title="Review Queue"
        description="Review and process fund requests"
      />

      {showQueueTabs && (
        <Tabs value={queueViewMode} onValueChange={setViewModeUserPick}>
          <TabsList className="bg-white/70 border flex-wrap h-auto gap-1 py-1">
            <TabsTrigger
              value="all_org_pending"
              className="data-[state=active]:bg-slate-800 data-[state=active]:text-white"
            >
              All pending
            </TabsTrigger>
            <TabsTrigger value="role_queue" className="data-[state=active]:bg-violet-600 data-[state=active]:text-white">
              Role Queue
            </TabsTrigger>
            <TabsTrigger value="my_funds" className="data-[state=active]:bg-emerald-600 data-[state=active]:text-white">
              All for My Funds
            </TabsTrigger>
          </TabsList>
        </Tabs>
      )}

      {/* Filters */}
      <Card className="bg-white/70 backdrop-blur-xs border-slate-200/50">
        <CardContent className="p-4">
          <div className="space-y-4">
            <div className="flex flex-col sm:flex-row gap-4">
              <div className="relative flex-1">
                <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-slate-400" />
                <Input
                  placeholder="Search by Request ID, student, or fund..."
                  className="pl-9"
                  value={searchTerm}
                  onChange={(e) => setSearchTerm(e.target.value)}
                />
              </div>
            </div>
            
            <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
              <Select value={statusFilter} onValueChange={setStatusFilter}>
                <SelectTrigger>
                  <SelectValue placeholder="Status" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="all">All Status</SelectItem>
                  <SelectItem value="Submitted">Submitted</SelectItem>
                  <SelectItem value="In Review">In Review</SelectItem>
                  <SelectItem value="Needs Info">Needs Info</SelectItem>
                  <SelectItem value="Approved">Approved</SelectItem>
                  <SelectItem value="Denied">Denied</SelectItem>
                  <SelectItem value="Paid">Paid</SelectItem>
                </SelectContent>
              </Select>

              <Select value={fundFilter} onValueChange={setFundFilter}>
                <SelectTrigger>
                  <SelectValue placeholder="Fund" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="all">All Funds</SelectItem>
                  {funds.map((fund) => (
                    <SelectItem key={fund.id} value={fund.id}>{fund.fund_name}</SelectItem>
                  ))}
                </SelectContent>
              </Select>

              <Select value={categoryFilter} onValueChange={setCategoryFilter}>
                <SelectTrigger>
                  <SelectValue placeholder="Category" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="all">All Categories</SelectItem>
                  {categories.map((cat) => (
                    <SelectItem key={cat} value={cat}>{cat}</SelectItem>
                  ))}
                </SelectContent>
              </Select>

              <div className="flex gap-2">
                <Input
                  type="number"
                  placeholder="Min $"
                  value={minAmount}
                  onChange={(e) => setMinAmount(e.target.value)}
                  className="w-full"
                />
                <Input
                  type="number"
                  placeholder="Max $"
                  value={maxAmount}
                  onChange={(e) => setMaxAmount(e.target.value)}
                  className="w-full"
                />
              </div>
            </div>
          </div>
        </CardContent>
      </Card>

      {/* Requests Table */}
      <Card className="bg-white/70 backdrop-blur-xs border-slate-200/50 overflow-hidden">
        {isLoading ? (
          <LoadingSpinner className="py-16" />
        ) : filteredRequests.length === 0 ? (
          <EmptyState
            icon={ClipboardList}
            title="No Requests Found"
            description="No requests match your current filters."
          />
        ) : (
          <>
            {/* Mobile View */}
            <div className="md:hidden divide-y">
              {filteredRequests.map((request) => (
                <Link
                  key={request.id}
                  to={createPageUrl(`ReviewRequest?id=${request.id}`)}
                  className="block p-4 hover:bg-slate-50 transition-colors"
                >
                  <div className="flex items-start justify-between mb-2">
                    <div>
                      <p className="font-semibold text-slate-800">{request.student_full_name}</p>
                      <p className="text-sm text-slate-500">{request.fund_name}</p>
                    </div>
                    <StatusBadge status={request.status} />
                  </div>
                  <div className="flex items-center gap-4 text-sm text-slate-500">
                    <div className="flex items-center gap-1">
                      <DollarSign className="w-4 h-4" />
                      {request.requested_amount?.toLocaleString()}
                    </div>
                    <div className="flex items-center gap-1">
                      <Calendar className="w-4 h-4" />
                      {format(new Date(request.created_date), "MMM d")}
                    </div>
                  </div>
                </Link>
              ))}
            </div>

            {/* Desktop View */}
            <div className="hidden md:block">
              <Table>
                <TableHeader>
                  <TableRow className="bg-slate-50/50">
                    <TableHead>Request ID</TableHead>
                    <TableHead>Student</TableHead>
                    <TableHead>Fund</TableHead>
                    <TableHead>Amount</TableHead>
                    <TableHead>Category</TableHead>
                    <TableHead>Current Step</TableHead>
                    <TableHead>Status</TableHead>
                    <TableHead>Age</TableHead>
                    <TableHead className="w-12"></TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {filteredRequests.map((request) => {
                    const daysSince = getDaysSince(request.submitted_at || request.created_date);
                    
                    return (
                      <TableRow key={request.id} className="group hover:bg-slate-50/50">
                        <TableCell>
                          <span className="font-mono text-sm">{request.request_id}</span>
                        </TableCell>
                        <TableCell>
                          <div>
                            <p className="font-medium">{request.student_full_name}</p>
                            <p className="text-xs text-slate-500">{request.student_email}</p>
                          </div>
                        </TableCell>
                        <TableCell className="text-slate-600">{request.fund_name}</TableCell>
                        <TableCell className="font-semibold">${request.requested_amount?.toLocaleString()}</TableCell>
                        <TableCell>
                          <Badge variant="secondary" className="bg-slate-100 text-xs">
                            {request.intended_use_category}
                          </Badge>
                        </TableCell>
                        <TableCell>
                          <span className="text-sm text-slate-600">
                            {request.current_step || "Not started"}
                          </span>
                        </TableCell>
                        <TableCell>
                          <StatusBadge status={request.status} />
                        </TableCell>
                        <TableCell>
                          <div className="flex items-center gap-1 text-slate-500">
                            <Clock className="w-3 h-3" />
                            <span className="text-sm">{daysSince}d</span>
                          </div>
                        </TableCell>
                        <TableCell>
                          <Button variant="ghost" size="sm" asChild>
                            <Link to={createPageUrl(`ReviewRequest?id=${request.id}`)}>
                              <ArrowRight className="w-4 h-4" />
                            </Link>
                          </Button>
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
    </div>
  );
}