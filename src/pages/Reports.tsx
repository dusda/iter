import React, { useState, useEffect } from "react";
import { api } from "@/api/supabaseApi";
import { useQuery } from "@tanstack/react-query";
import PageHeader from "@/components/shared/PageHeader";
import LoadingSpinner from "@/components/shared/LoadingSpinner";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Badge } from "@/components/ui/badge";
import { Download, DollarSign, PieChart, TrendingUp, FileText, CheckCircle, XCircle, Clock, Wallet } from "lucide-react";
import { format, startOfMonth, parseISO } from "date-fns";
import { BarChart, Bar, PieChart as RechartPie, Pie, Cell, LineChart, Line, XAxis, YAxis, CartesianGrid, Tooltip, Legend, ResponsiveContainer } from "recharts";
import { toast } from "@/components/ui/use-toast";

interface ReportRequest {
  id: string;
  fund_id: string;
  fund_name: string;
  request_id: string;
  student_full_name: string;
  student_email: string;
  intended_use_category?: string | null;
  intended_use_description?: string | null;
  requested_amount?: number | null;
  status: string;
  submitted_at?: string | null;
}

interface ReportFund {
  id: string;
  fund_owner_id: string;
  fund_name: string;
  total_budget?: number | null;
}

interface ReportDisbursement {
  id: string;
  fund_id: string;
  fund_name: string;
  fund_request_id: string;
  student_name: string;
  amount_paid?: number | null;
  paid_at: string;
  payment_method: string;
}

interface ReportReview {
  id: string;
  fund_request_id: string;
  decision: string;
  decided_at?: string | null;
}

type UsageByCategory = Record<
  string,
  { count: number; total: number; disbursed: number }
>;

type SpendByMonth = Record<string, number>;

export default function Reports() {
  const [selectedFund, setSelectedFund] = useState("all");
  const [dateRange, setDateRange] = useState("all");

  const { data: user, isLoading: userLoading } = useQuery({
    queryKey: ["me"],
    queryFn: () => api.auth.me(),
  });

  const { data: requests = [] } = useQuery<ReportRequest[]>({
    queryKey: ["fundRequests", user?.organization_id],
    enabled: !!user?.organization_id,
    queryFn: () => api.entities.FundRequest.filter({ organization_id: user.organization_id }),
  });

  const { data: funds = [] } = useQuery<ReportFund[]>({
    queryKey: ["funds", user?.organization_id],
    enabled: !!user?.organization_id,
    queryFn: () => api.entities.Fund.filter({ organization_id: user.organization_id }),
  });

  const { data: disbursements = [] } = useQuery<ReportDisbursement[]>({
    queryKey: ["disbursements", user?.organization_id],
    enabled: !!user?.organization_id,
    queryFn: () =>
      api.entities.Disbursement.filter({ organization_id: user.organization_id }, "-paid_at"),
  });

  const { data: reviews = [] } = useQuery<ReportReview[]>({
    queryKey: ["reviews", user?.organization_id],
    enabled: !!user?.organization_id,
    queryFn: () => api.entities.Review.filter({ organization_id: user.organization_id }),
  });

  // Filter funds based on user role
  const availableFunds = user?.app_role === "admin" || user?.app_role === "super_admin"
    ? funds 
    : funds.filter(f => f.fund_owner_id === user?.id);

  // Filter data
  const filteredRequests = requests.filter(r => {
    // Fund managers see only their funds (unless admin)
    if (user?.app_role !== "admin" && user?.app_role !== "super_admin") {
      const isMyFund = availableFunds.some(f => f.id === r.fund_id);
      if (!isMyFund) return false;
    }

    const fundMatch = selectedFund === "all" || r.fund_id === selectedFund;
    
    let dateMatch = true;
    if (dateRange !== "all" && r.submitted_at) {
      const submitDate = new Date(r.submitted_at);
      const now = new Date();
      const diffMs = now.getTime() - submitDate.getTime();
      if (dateRange === "30days") {
        dateMatch = diffMs <= 30 * 24 * 60 * 60 * 1000;
      } else if (dateRange === "90days") {
        dateMatch = diffMs <= 90 * 24 * 60 * 60 * 1000;
      } else if (dateRange === "year") {
        dateMatch = submitDate.getFullYear() === now.getFullYear();
      }
    }
    
    return fundMatch && dateMatch;
  });

  const filteredDisbursements = disbursements.filter(d => {
    if (user?.app_role !== "admin" && user?.app_role !== "super_admin") {
      const isMyFund = availableFunds.some(f => f.id === d.fund_id);
      if (!isMyFund) return false;
    }
    return selectedFund === "all" || d.fund_id === selectedFund;
  });

  // Calculate stats
  const totalBudget: number =
    selectedFund === "all"
      ? availableFunds.reduce(
          (sum, f) => sum + (f.total_budget ?? 0),
          0
        )
      : availableFunds.find(f => f.id === selectedFund)?.total_budget ?? 0;

  const totalRequested: number = filteredRequests.reduce(
    (sum, r) => sum + (r.requested_amount ?? 0),
    0
  );
  const totalApproved: number = filteredRequests
    .filter(r => ["Approved", "Paid"].includes(r.status))
    .reduce((sum, r) => sum + (r.requested_amount ?? 0), 0);

  const totalDisbursed: number = filteredDisbursements.reduce(
    (sum, d) => sum + (d.amount_paid ?? 0),
    0
  );
  const remaining: number = totalBudget - totalDisbursed;

  const submittedCount: number = filteredRequests.filter(
    r => r.status !== "Draft"
  ).length;
  const approvedCount: number = filteredRequests.filter(r =>
    ["Approved", "Paid"].includes(r.status)
  ).length;
  const deniedCount: number = filteredRequests.filter(
    r => r.status === "Denied"
  ).length;
  const paidCount: number = filteredRequests.filter(
    r => r.status === "Paid"
  ).length;
  const avgRequested: number =
    submittedCount > 0 ? totalRequested / submittedCount : 0;

  // Usage by category
  const usageByCategory: UsageByCategory = {};
  filteredRequests.forEach(r => {
    const category = r.intended_use_category || "Other";
    if (!usageByCategory[category]) {
      usageByCategory[category] = { count: 0, total: 0, disbursed: 0 };
    }
    usageByCategory[category].count++;
    usageByCategory[category].total += r.requested_amount || 0;
  });

  filteredDisbursements.forEach(d => {
    const request = requests.find(r => r.id === d.fund_request_id);
    if (request) {
      const category = request.intended_use_category || "Other";
      if (usageByCategory[category]) {
        usageByCategory[category].disbursed += d.amount_paid || 0;
      }
    }
  });

  // Chart data - spend over time (monthly)
  const spendByMonth: SpendByMonth = {};
  filteredDisbursements.forEach(d => {
    const monthKey = format(parseISO(d.paid_at), "MMM yyyy");
    if (!spendByMonth[monthKey]) {
      spendByMonth[monthKey] = 0;
    }
    spendByMonth[monthKey] += d.amount_paid || 0;
  });
  
  const spendOverTimeData = Object.entries(spendByMonth)
    .map(([month, amount]) => ({ month, amount }))
    .slice(-6); // Last 6 months

  // Approved vs Denied data
  const pendingCount: number =
    submittedCount - approvedCount - deniedCount;

  const approvalData = [
    { name: "Approved", value: approvedCount, color: "#10b981" },
    { name: "Denied", value: deniedCount, color: "#ef4444" },
    { name: "Pending", value: pendingCount, color: "#f59e0b" }
  ].filter(d => d.value > 0);

  // Export to CSV
  const exportToCSV = () => {
    if (filteredRequests.length === 0) {
      toast({
        title: "No data to export",
        description: "Adjust your filters or date range to include at least one request before exporting.",
        variant: "warning",
      });
      return;
    }
    const csvRows: (string | number)[][] = [
      [
        "Request ID",
        "Student Name",
        "Email",
        "Fund",
        "Category",
        "Intended Use",
        "Requested",
        "Approved",
        "Paid",
        "Status",
        "Submitted Date",
        "Decision Date",
      ],
    ];

    filteredRequests.forEach(r => {
      const requestDisbursements = disbursements.filter(d => d.fund_request_id === r.id);
      const totalPaid = requestDisbursements.reduce((sum, d) => sum + (d.amount_paid || 0), 0);
      const isApproved = ["Approved", "Paid"].includes(r.status);
      const approvedAmount = isApproved ? r.requested_amount : 0;
      
      // Get decision date from reviews
      const finalReview = reviews
        .filter(
          rev =>
            rev.fund_request_id === r.id &&
            ["Approved", "Denied"].includes(rev.decision)
        )
        .sort(
          (a, b) =>
            new Date(b.decided_at || 0).getTime() -
            new Date(a.decided_at || 0).getTime()
        )[0];
      
      csvRows.push([
        r.request_id || "",
        r.student_full_name || "",
        r.student_email || "",
        r.fund_name || "",
        r.intended_use_category || "",
        `"${(r.intended_use_description || "").replace(/"/g, '""').substring(0, 200)}"`,
        r.requested_amount || 0,
        approvedAmount,
        totalPaid,
        r.status || "",
        r.submitted_at ? format(new Date(r.submitted_at), "yyyy-MM-dd") : "",
        finalReview?.decided_at ? format(new Date(finalReview.decided_at), "yyyy-MM-dd") : ""
      ]);
    });

    const csv = csvRows.map(row => row.join(",")).join("\n");
    const blob = new Blob([csv], { type: "text/csv" });
    const url = window.URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url;
    a.download = `fund-requests-report-${format(new Date(), "yyyy-MM-dd")}.csv`;
    a.click();
  };

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
        title="Reports & Analytics"
        description="Track fund usage and disbursements"
        actions={
          <Button onClick={exportToCSV} className="bg-emerald-600 hover:bg-emerald-700 text-white">
            <Download className="w-4 h-4 mr-2" />
            Export CSV
          </Button>
        }
      />

      {/* Filters */}
      <Card className="bg-white/70 backdrop-blur-xs border-slate-200/50 dark:bg-slate-900/70 dark:border-slate-800/50">
        <CardContent className="p-4">
          <div className="flex flex-col sm:flex-row gap-4">
            <Select value={selectedFund} onValueChange={setSelectedFund}>
              <SelectTrigger className="w-full sm:w-64">
                <SelectValue placeholder="Select fund" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="all">
                  {user?.app_role === "admin" ? "All Funds" : "All My Funds"}
                </SelectItem>
                {availableFunds.map(f => (
                  <SelectItem key={f.id} value={f.id}>{f.fund_name}</SelectItem>
                ))}
              </SelectContent>
            </Select>

            <Select value={dateRange} onValueChange={setDateRange}>
              <SelectTrigger className="w-full sm:w-48">
                <SelectValue placeholder="Date range" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="all">All Time</SelectItem>
                <SelectItem value="30days">Last 30 Days</SelectItem>
                <SelectItem value="90days">Last 90 Days</SelectItem>
                <SelectItem value="year">This Year</SelectItem>
              </SelectContent>
            </Select>
          </div>
        </CardContent>
      </Card>

      {/* Summary Stats */}
      <div className="grid md:grid-cols-2 lg:grid-cols-4 gap-4">
        <Card className="bg-linear-to-br from-indigo-50 to-indigo-100/50 border-indigo-200 dark:from-indigo-950/30 dark:to-indigo-900/30 dark:border-indigo-900/50">
          <CardContent className="p-6">
            <div className="flex items-center justify-between mb-2">
              <p className="text-sm text-indigo-700 font-medium dark:text-indigo-300">Total Budget</p>
              <Wallet className="w-5 h-5 text-indigo-400 dark:text-indigo-500" />
            </div>
            <p className="text-3xl font-bold text-indigo-900 dark:text-indigo-100">${totalBudget.toLocaleString()}</p>
          </CardContent>
        </Card>

        <Card className="bg-linear-to-br from-emerald-50 to-emerald-100/50 border-emerald-200 dark:from-emerald-950/30 dark:to-emerald-900/30 dark:border-emerald-900/50">
          <CardContent className="p-6">
            <div className="flex items-center justify-between mb-2">
              <p className="text-sm text-emerald-700 font-medium dark:text-emerald-300">Total Approved</p>
              <CheckCircle className="w-5 h-5 text-emerald-400 dark:text-emerald-500" />
            </div>
            <p className="text-3xl font-bold text-emerald-900 dark:text-emerald-100">${totalApproved.toLocaleString()}</p>
            <p className="text-sm text-emerald-600 mt-1 dark:text-emerald-400">{approvedCount} requests</p>
          </CardContent>
        </Card>

        <Card className="bg-linear-to-br from-violet-50 to-violet-100/50 border-violet-200 dark:from-violet-950/30 dark:to-violet-900/30 dark:border-violet-900/50">
          <CardContent className="p-6">
            <div className="flex items-center justify-between mb-2">
              <p className="text-sm text-violet-700 font-medium dark:text-violet-300">Total Paid</p>
              <DollarSign className="w-5 h-5 text-violet-400 dark:text-violet-500" />
            </div>
            <p className="text-3xl font-bold text-violet-900 dark:text-violet-100">${totalDisbursed.toLocaleString()}</p>
            <p className="text-sm text-violet-600 mt-1 dark:text-violet-400">{paidCount} paid</p>
          </CardContent>
        </Card>

        <Card className="bg-linear-to-br from-slate-50 to-slate-100/50 border-slate-200 dark:border-slate-800 dark:from-slate-950 dark:to-slate-900">
          <CardContent className="p-6">
            <div className="flex items-center justify-between mb-2">
              <p className="text-sm text-slate-700 font-medium dark:text-slate-200">Remaining</p>
              <TrendingUp className="w-5 h-5 text-slate-400 dark:text-slate-500" />
            </div>
            <p className="text-3xl font-bold text-slate-900 dark:text-slate-50">${remaining.toLocaleString()}</p>
            <p className="text-sm text-slate-600 mt-1 dark:text-slate-300">
              {((remaining / totalBudget) * 100 || 0).toFixed(1)}% left
            </p>
          </CardContent>
        </Card>
      </div>

      {/* Request Counts */}
      <div className="grid md:grid-cols-4 gap-4">
        <Card className="bg-white/70 backdrop-blur-xs border-slate-200/50 dark:bg-slate-900/70 dark:border-slate-800/50">
          <CardContent className="p-4">
            <p className="text-sm text-slate-500 mb-1 dark:text-slate-400">Submitted</p>
            <p className="text-2xl font-bold">{submittedCount}</p>
          </CardContent>
        </Card>

        <Card className="bg-white/70 backdrop-blur-xs border-slate-200/50 dark:bg-slate-900/70 dark:border-slate-800/50">
          <CardContent className="p-4">
            <p className="text-sm text-slate-500 mb-1 dark:text-slate-400">Approved</p>
            <p className="text-2xl font-bold text-emerald-600 dark:text-emerald-400">{approvedCount}</p>
          </CardContent>
        </Card>

        <Card className="bg-white/70 backdrop-blur-xs border-slate-200/50 dark:bg-slate-900/70 dark:border-slate-800/50">
          <CardContent className="p-4">
            <p className="text-sm text-slate-500 mb-1 dark:text-slate-400">Denied</p>
            <p className="text-2xl font-bold text-red-600 dark:text-red-400">{deniedCount}</p>
          </CardContent>
        </Card>

        <Card className="bg-white/70 backdrop-blur-xs border-slate-200/50 dark:bg-slate-900/70 dark:border-slate-800/50">
          <CardContent className="p-4">
            <p className="text-sm text-slate-500 mb-1 dark:text-slate-400">Average Requested</p>
            <p className="text-2xl font-bold">${avgRequested.toLocaleString(undefined, {maximumFractionDigits: 0})}</p>
          </CardContent>
        </Card>
      </div>

      {/* Charts */}
      <div className="grid lg:grid-cols-2 gap-6">
        {/* Spend Over Time */}
        <Card className="bg-white/70 backdrop-blur-xs border-slate-200/50 dark:bg-slate-900/70 dark:border-slate-800/50">
          <CardHeader>
            <CardTitle className="flex items-center gap-2 text-lg">
              <TrendingUp className="w-5 h-5" />
              Spend Over Time
            </CardTitle>
          </CardHeader>
          <CardContent>
            {spendOverTimeData.length === 0 ? (
              <p className="text-slate-500 text-center py-8 dark:text-slate-400">No disbursement data</p>
            ) : (
              <ResponsiveContainer width="100%" height={250}>
                <LineChart data={spendOverTimeData}>
                  <CartesianGrid strokeDasharray="3 3" stroke="#e2e8f0" />
                  <XAxis dataKey="month" tick={{ fontSize: 12 }} />
                  <YAxis tick={{ fontSize: 12 }} />
                  <Tooltip 
                    formatter={(value) => `$${value.toLocaleString()}`}
                    contentStyle={{ background: "white", border: "1px solid #e2e8f0", borderRadius: "8px" }}
                  />
                  <Line type="monotone" dataKey="amount" stroke="#8b5cf6" strokeWidth={2} dot={{ fill: "#8b5cf6" }} />
                </LineChart>
              </ResponsiveContainer>
            )}
          </CardContent>
        </Card>

        {/* Approved vs Denied */}
        <Card className="bg-white/70 backdrop-blur-xs border-slate-200/50 dark:bg-slate-900/70 dark:border-slate-800/50">
          <CardHeader>
            <CardTitle className="flex items-center gap-2 text-lg">
              <PieChart className="w-5 h-5" />
              Request Outcomes
            </CardTitle>
          </CardHeader>
          <CardContent>
            {approvalData.length === 0 ? (
              <p className="text-slate-500 text-center py-8 dark:text-slate-400">No data</p>
            ) : (
              <ResponsiveContainer width="100%" height={250}>
                <RechartPie>
                  <Pie
                    data={approvalData}
                    cx="50%"
                    cy="50%"
                    labelLine={false}
                    label={({ name, percent }) => `${name} ${(percent * 100).toFixed(0)}%`}
                    outerRadius={80}
                    fill="#8884d8"
                    dataKey="value"
                  >
                    {approvalData.map((entry, index) => (
                      <Cell key={`cell-${index}`} fill={entry.color} />
                    ))}
                  </Pie>
                  <Tooltip />
                </RechartPie>
              </ResponsiveContainer>
            )}
          </CardContent>
        </Card>
      </div>

      {/* Usage by Category */}
      <Card className="bg-white/70 backdrop-blur-xs border-slate-200/50 dark:bg-slate-900/70 dark:border-slate-800/50">
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <FileText className="w-5 h-5" />
            Requests by Category
          </CardTitle>
        </CardHeader>
        <CardContent>
          {Object.keys(usageByCategory).length === 0 ? (
            <p className="text-slate-500 text-center py-8 dark:text-slate-400">No data</p>
          ) : (
            <>
              <div className="mb-6">
                <ResponsiveContainer width="100%" height={300}>
                  <BarChart data={Object.entries(usageByCategory).map(([cat, data]) => ({
                    category: cat,
                    requested: data.total,
                    disbursed: data.disbursed
                  }))}>
                    <CartesianGrid strokeDasharray="3 3" stroke="#e2e8f0" />
                    <XAxis dataKey="category" tick={{ fontSize: 11 }} angle={-15} textAnchor="end" height={80} />
                    <YAxis tick={{ fontSize: 12 }} />
                    <Tooltip 
                      formatter={(value) => `$${value.toLocaleString()}`}
                      contentStyle={{ background: "white", border: "1px solid #e2e8f0", borderRadius: "8px" }}
                    />
                    <Legend />
                    <Bar dataKey="requested" fill="#6366f1" name="Requested" />
                    <Bar dataKey="disbursed" fill="#8b5cf6" name="Disbursed" />
                  </BarChart>
                </ResponsiveContainer>
              </div>
              
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead>Category</TableHead>
                    <TableHead className="text-right">Requests</TableHead>
                    <TableHead className="text-right">Requested</TableHead>
                    <TableHead className="text-right">Disbursed</TableHead>
                    <TableHead className="text-right">% of Total</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {Object.entries(usageByCategory)
                    .sort((a, b) => b[1].total - a[1].total)
                    .map(([category, data]) => (
                      <TableRow key={category}>
                        <TableCell>
                          <Badge variant="secondary">{category}</Badge>
                        </TableCell>
                        <TableCell className="text-right">{data.count}</TableCell>
                        <TableCell className="text-right font-medium">
                          ${data.total.toLocaleString()}
                        </TableCell>
                        <TableCell className="text-right text-violet-600 font-medium dark:text-violet-400">
                          ${data.disbursed.toLocaleString()}
                        </TableCell>
                        <TableCell className="text-right">
                          {((data.total / totalRequested) * 100 || 0).toFixed(1)}%
                        </TableCell>
                      </TableRow>
                    ))}
                </TableBody>
              </Table>
            </>
          )}
        </CardContent>
      </Card>

      {/* Recent Disbursements */}
      <Card className="bg-white/70 backdrop-blur-xs border-slate-200/50 dark:bg-slate-900/70 dark:border-slate-800/50">
        <CardHeader>
          <CardTitle>Recent Disbursements</CardTitle>
        </CardHeader>
        <CardContent>
          {filteredDisbursements.length === 0 ? (
            <p className="text-slate-500 text-center py-8 dark:text-slate-400">No disbursements yet</p>
          ) : (
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>Student</TableHead>
                  <TableHead>Fund</TableHead>
                  <TableHead>Category</TableHead>
                  <TableHead>Intended Use</TableHead>
                  <TableHead className="text-right">Amount</TableHead>
                  <TableHead>Date</TableHead>
                  <TableHead>Method</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {filteredDisbursements.slice(0, 10).map((d) => {
                  const request = requests.find(r => r.id === d.fund_request_id);
                  return (
                    <TableRow key={d.id}>
                      <TableCell className="font-medium">{d.student_name}</TableCell>
                      <TableCell>{d.fund_name}</TableCell>
                      <TableCell>
                        <Badge variant="outline" className="text-xs">
                          {request?.intended_use_category || "N/A"}
                        </Badge>
                      </TableCell>
                      <TableCell className="max-w-xs truncate text-sm text-slate-600 dark:text-slate-300">
                        {request?.intended_use_description || "N/A"}
                      </TableCell>
                      <TableCell className="text-right font-semibold">
                        ${d.amount_paid?.toLocaleString()}
                      </TableCell>
                      <TableCell>{format(new Date(d.paid_at), "MMM d, yyyy")}</TableCell>
                      <TableCell>{d.payment_method}</TableCell>
                    </TableRow>
                  );
                })}
              </TableBody>
            </Table>
          )}
        </CardContent>
      </Card>
    </div>
  );
}