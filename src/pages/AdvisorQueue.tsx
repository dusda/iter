import React, { useState, useEffect } from "react";
import { useNavigate } from "react-router-dom";
import { createPageUrl } from "@/utils";
import { api } from "@/api/supabaseApi";
import { useQuery } from "@tanstack/react-query";
import PageHeader from "@/components/shared/PageHeader";
import LoadingSpinner from "@/components/shared/LoadingSpinner";
import EmptyState from "@/components/shared/EmptyState";
import StatusBadge from "@/components/shared/StatusBadge";
import { Card, CardContent } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import {
  FileText,
  Search,
  CheckCircle,
  Clock,
  ArrowRight,
  ClipboardList
} from "lucide-react";
import { format } from "date-fns";

export default function AdvisorQueue() {
  const navigate = useNavigate();
  const [user, setUser] = useState(null);
  const [searchTerm, setSearchTerm] = useState("");

  useEffect(() => {
    loadUser();
  }, []);

  const loadUser = async () => {
    const currentUser = await api.auth.me();
    setUser(currentUser);
  };

  const { data: requests = [], isLoading } = useQuery({
    queryKey: ["advisorRequests", user?.id],
    queryFn: async () => {
      if (!user?.id) return [];
      return api.entities.FundRequest.filter(
        { advisor_user_id: user.id },
        "-created_date"
      );
    },
    enabled: !!user?.id,
  });

  const filteredRequests = requests.filter((req) => {
    const matchesSearch =
      req.student_full_name?.toLowerCase().includes(searchTerm.toLowerCase()) ||
      req.request_id?.toLowerCase().includes(searchTerm.toLowerCase()) ||
      req.fund_name?.toLowerCase().includes(searchTerm.toLowerCase());
    return matchesSearch;
  });

  const pendingRequests = filteredRequests.filter(r => !r.advisor_tasks_completed);
  const completedRequests = filteredRequests.filter(r => r.advisor_tasks_completed);

  if (!user) {
    return (
      <div className="flex items-center justify-center min-h-[60vh]">
        <LoadingSpinner size="lg" />
      </div>
    );
  }

  return (
    <div className="space-y-6">
      <PageHeader
        title="Assigned Applications"
        description="Review and manage applications assigned to you"
      />

      {/* Stats Cards */}
      <div className="grid md:grid-cols-2 gap-4">
        <Card className="bg-linear-to-br from-amber-50 to-orange-50 border-amber-200 dark:from-amber-950/30 dark:to-orange-950/30 dark:border-amber-900/50">
          <CardContent className="p-6">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-sm font-medium text-amber-600 dark:text-amber-400">Pending Tasks</p>
                <p className="text-3xl font-bold text-amber-900 mt-1 dark:text-amber-100">
                  {pendingRequests.length}
                </p>
              </div>
              <Clock className="w-12 h-12 text-amber-400 dark:text-amber-500" />
            </div>
          </CardContent>
        </Card>

        <Card className="bg-linear-to-br from-green-50 to-emerald-50 border-green-200 dark:from-green-950/30 dark:to-emerald-950/30 dark:border-green-900/50">
          <CardContent className="p-6">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-sm font-medium text-green-600 dark:text-green-400">Completed</p>
                <p className="text-3xl font-bold text-green-900 mt-1 dark:text-green-100">
                  {completedRequests.length}
                </p>
              </div>
              <CheckCircle className="w-12 h-12 text-green-400 dark:text-green-500" />
            </div>
          </CardContent>
        </Card>
      </div>

      {/* Search */}
      <Card className="bg-white/70 backdrop-blur-xs border-slate-200/50 dark:bg-slate-900/70 dark:border-slate-800/50">
        <CardContent className="p-4">
          <div className="relative">
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-slate-400 dark:text-slate-500" />
            <Input
              placeholder="Search by student name, request ID, or fund..."
              className="pl-9"
              value={searchTerm}
              onChange={(e) => setSearchTerm(e.target.value)}
            />
          </div>
        </CardContent>
      </Card>

      {/* Requests Table */}
      <Card className="bg-white/70 backdrop-blur-xs border-slate-200/50 overflow-hidden dark:bg-slate-900/70 dark:border-slate-800/50">
        {isLoading ? (
          <LoadingSpinner className="py-16" />
        ) : filteredRequests.length === 0 ? (
          <EmptyState
            icon={ClipboardList}
            title="No Applications Assigned"
            description="You don't have any applications assigned to you yet."
          />
        ) : (
          <>
            {/* Mobile View */}
            <div className="md:hidden divide-y">
              {filteredRequests.map((request) => (
                <div key={request.id} className="p-4 hover:bg-slate-50 dark:hover:bg-slate-800">
                  <div className="flex items-start justify-between mb-3">
                  <div>
                    <p className="font-semibold text-slate-800 dark:text-slate-100">{request.student_full_name}</p>
                    <p className="text-sm text-slate-500 dark:text-slate-400">{request.request_id}</p>
                  </div>
                  {request.advisor_tasks_completed ? (
                    <CheckCircle className="w-5 h-5 text-green-500 dark:text-green-400" />
                  ) : (
                    <Clock className="w-5 h-5 text-amber-500 dark:text-amber-400" />
                  )}
                  </div>
                  <div className="space-y-2 text-sm">
                    <div className="flex justify-between">
                      <span className="text-slate-500 dark:text-slate-400">Fund:</span>
                      <span className="font-medium">{request.fund_name}</span>
                    </div>
                    <div className="flex justify-between">
                      <span className="text-slate-500 dark:text-slate-400">Amount:</span>
                      <span className="font-medium">${request.requested_amount?.toLocaleString()}</span>
                    </div>
                    <div className="flex justify-between items-center">
                      <span className="text-slate-500 dark:text-slate-400">Status:</span>
                      <StatusBadge status={request.status} />
                    </div>
                  </div>
                  <Button
                    className="w-full mt-4"
                    onClick={() => navigate(createPageUrl(`AdvisorRequestDetail?id=${request.id}`))}
                  >
                    View Details
                    <ArrowRight className="w-4 h-4 ml-2" />
                  </Button>
                </div>
              ))}
            </div>

            {/* Desktop View */}
            <div className="hidden md:block">
              <Table>
                <TableHeader>
                  <TableRow className="bg-slate-50/50 dark:bg-slate-900/50">
                    <TableHead>Request ID</TableHead>
                    <TableHead>Student</TableHead>
                    <TableHead>Fund</TableHead>
                    <TableHead>Amount</TableHead>
                    <TableHead>Status</TableHead>
                    <TableHead>Tasks</TableHead>
                    <TableHead>Submitted</TableHead>
                    <TableHead className="w-32">Actions</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {filteredRequests.map((request) => (
                    <TableRow key={request.id} className="hover:bg-slate-50/50 dark:hover:bg-slate-800/50">
                      <TableCell className="font-mono text-sm">
                        {request.request_id}
                      </TableCell>
                      <TableCell>
                        <div>
                          <p className="font-medium">{request.student_full_name}</p>
                          <p className="text-xs text-slate-500 dark:text-slate-400">{request.student_email}</p>
                        </div>
                      </TableCell>
                      <TableCell>{request.fund_name}</TableCell>
                      <TableCell className="font-semibold">
                        ${request.requested_amount?.toLocaleString()}
                      </TableCell>
                      <TableCell>
                        <StatusBadge status={request.status} />
                      </TableCell>
                      <TableCell>
                        {request.advisor_tasks_completed ? (
                          <div className="flex items-center gap-2 text-green-600 dark:text-green-400">
                            <CheckCircle className="w-4 h-4" />
                            <span className="text-sm font-medium">Complete</span>
                          </div>
                        ) : (
                          <div className="flex items-center gap-2 text-amber-600 dark:text-amber-400">
                            <Clock className="w-4 h-4" />
                            <span className="text-sm font-medium">Pending</span>
                          </div>
                        )}
                      </TableCell>
                      <TableCell className="text-slate-500 text-sm dark:text-slate-400">
                        {request.submitted_at
                          ? format(new Date(request.submitted_at), "MMM d, yyyy")
                          : "Not submitted"}
                      </TableCell>
                      <TableCell>
                        <Button
                          size="sm"
                          onClick={() => navigate(createPageUrl(`AdvisorRequestDetail?id=${request.id}`))}
                        >
                          View
                        </Button>
                      </TableCell>
                    </TableRow>
                  ))}
                </TableBody>
              </Table>
            </div>
          </>
        )}
      </Card>
    </div>
  );
}