import React, { useState, useEffect } from "react";
import { Link } from "react-router-dom";
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
import {
  FileText,
  Search,
  Filter,
  PlusCircle,
  ArrowRight,
  Calendar,
  DollarSign,
  Hash,
  Eye
} from "lucide-react";
import { format } from "date-fns";

export default function MyRequests() {
  const [user, setUser] = useState(null);
  const [searchTerm, setSearchTerm] = useState("");
  const [statusFilter, setStatusFilter] = useState("all");

  useEffect(() => {
    loadUser();
  }, []);

  const loadUser = async () => {
    const currentUser = await api.auth.me();
    setUser(currentUser);
  };

  const { data: requests = [], isLoading } = useQuery({
    queryKey: ["myRequests", user?.id],
    queryFn: () => api.entities.FundRequest.filter({ student_user_id: user.id }, "-created_date"),
    enabled: !!user?.id,
  });

  const filteredRequests = requests.filter((request) => {
    const matchesSearch =
      request.request_id?.toLowerCase().includes(searchTerm.toLowerCase()) ||
      request.fund_name?.toLowerCase().includes(searchTerm.toLowerCase()) ||
      request.intended_use_category?.toLowerCase().includes(searchTerm.toLowerCase());
    const matchesStatus = statusFilter === "all" || request.status === statusFilter;
    return matchesSearch && matchesStatus;
  });

  const statusCounts = {
    all: requests.length,
    Draft: requests.filter(r => r.status === "Draft").length,
    Submitted: requests.filter(r => r.status === "Submitted").length,
    "In Review": requests.filter(r => r.status === "In Review").length,
    "Needs Info": requests.filter(r => r.status === "Needs Info").length,
    Approved: requests.filter(r => r.status === "Approved").length,
    Paid: requests.filter(r => r.status === "Paid").length,
    Denied: requests.filter(r => r.status === "Denied").length,
  };

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
        title="My Requests"
        description="Track and manage your fund requests"
        actions={
          <Button asChild className="bg-gradient-to-r from-indigo-600 to-violet-600 hover:from-indigo-700 hover:to-violet-700">
            <Link to={createPageUrl("Apply")}>
              <PlusCircle className="w-4 h-4 mr-2" />
              New Request
            </Link>
          </Button>
        }
      />

      {/* Quick Stats */}
      <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
        <Card className="bg-white/70 backdrop-blur-sm border-slate-200/50">
          <CardContent className="p-4">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-sm text-slate-500">Total</p>
                <p className="text-2xl font-bold text-slate-900">{statusCounts.all}</p>
              </div>
              <FileText className="w-8 h-8 text-indigo-200" />
            </div>
          </CardContent>
        </Card>
        
        <Card className="bg-white/70 backdrop-blur-sm border-slate-200/50">
          <CardContent className="p-4">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-sm text-slate-500">In Review</p>
                <p className="text-2xl font-bold text-amber-600">{statusCounts["In Review"]}</p>
              </div>
              <div className="w-8 h-8 rounded-full bg-amber-100 flex items-center justify-center">
                <span className="text-amber-600 font-bold">{statusCounts["In Review"]}</span>
              </div>
            </div>
          </CardContent>
        </Card>
        
        <Card className="bg-white/70 backdrop-blur-sm border-slate-200/50">
          <CardContent className="p-4">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-sm text-slate-500">Approved</p>
                <p className="text-2xl font-bold text-emerald-600">
                  {statusCounts.Approved + statusCounts.Paid}
                </p>
              </div>
              <div className="w-8 h-8 rounded-full bg-emerald-100 flex items-center justify-center">
                <span className="text-emerald-600 font-bold">{statusCounts.Approved + statusCounts.Paid}</span>
              </div>
            </div>
          </CardContent>
        </Card>
        
        <Card className="bg-white/70 backdrop-blur-sm border-slate-200/50">
          <CardContent className="p-4">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-sm text-slate-500">Need Action</p>
                <p className="text-2xl font-bold text-orange-600">{statusCounts["Needs Info"]}</p>
              </div>
              <div className="w-8 h-8 rounded-full bg-orange-100 flex items-center justify-center">
                <span className="text-orange-600 font-bold">{statusCounts["Needs Info"]}</span>
              </div>
            </div>
          </CardContent>
        </Card>
      </div>

      {/* Filters */}
      <Card className="bg-white/70 backdrop-blur-sm border-slate-200/50">
        <CardContent className="p-4">
          <div className="flex flex-col sm:flex-row gap-4">
            <div className="relative flex-1">
              <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-slate-400" />
              <Input
                placeholder="Search by request ID, fund, or category..."
                className="pl-9"
                value={searchTerm}
                onChange={(e) => setSearchTerm(e.target.value)}
              />
            </div>
            <Select value={statusFilter} onValueChange={setStatusFilter}>
              <SelectTrigger className="w-full sm:w-48">
                <Filter className="w-4 h-4 mr-2" />
                <SelectValue placeholder="Filter by status" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="all">All Statuses ({statusCounts.all})</SelectItem>
                <SelectItem value="Draft">Draft ({statusCounts.Draft})</SelectItem>
                <SelectItem value="Submitted">Submitted ({statusCounts.Submitted})</SelectItem>
                <SelectItem value="In Review">In Review ({statusCounts["In Review"]})</SelectItem>
                <SelectItem value="Needs Info">Needs Info ({statusCounts["Needs Info"]})</SelectItem>
                <SelectItem value="Approved">Approved ({statusCounts.Approved})</SelectItem>
                <SelectItem value="Denied">Denied ({statusCounts.Denied})</SelectItem>
                <SelectItem value="Paid">Paid ({statusCounts.Paid})</SelectItem>
              </SelectContent>
            </Select>
          </div>
        </CardContent>
      </Card>

      {/* Requests Table */}
      <Card className="bg-white/70 backdrop-blur-sm border-slate-200/50 overflow-hidden">
        {isLoading ? (
          <LoadingSpinner className="py-16" />
        ) : filteredRequests.length === 0 ? (
          <EmptyState
            icon={FileText}
            title="No Requests Found"
            description={requests.length === 0 ? "You haven't submitted any fund requests yet." : "No requests match your filters."}
            action={
              requests.length === 0 && (
                <Button asChild className="mt-4">
                  <Link to={createPageUrl("Apply")}>
                    <PlusCircle className="w-4 h-4 mr-2" />
                    Apply for Fund
                  </Link>
                </Button>
              )
            }
          />
        ) : (
          <>
            {/* Mobile View */}
            <div className="md:hidden divide-y">
              {filteredRequests.map((request) => (
                <Link
                  key={request.id}
                  to={createPageUrl(`RequestDetail?id=${request.id}`)}
                  className="block p-4 hover:bg-slate-50 transition-colors"
                >
                  <div className="flex items-start justify-between mb-2">
                    <div className="flex-1 min-w-0">
                      <div className="flex items-center gap-2 mb-1">
                        <Hash className="w-3 h-3 text-slate-400" />
                        <span className="text-xs font-mono text-slate-500">{request.request_id}</span>
                      </div>
                      <p className="font-semibold text-slate-800 truncate">{request.fund_name}</p>
                      <p className="text-sm text-slate-500">{request.intended_use_category}</p>
                    </div>
                    <StatusBadge status={request.status} />
                  </div>
                  <div className="flex items-center justify-between text-sm text-slate-500 mt-3">
                    <div className="flex items-center gap-1">
                      <DollarSign className="w-4 h-4" />
                      {request.requested_amount?.toLocaleString()}
                    </div>
                    <div className="flex items-center gap-1">
                      <Calendar className="w-4 h-4" />
                      {request.submitted_at
                        ? format(new Date(request.submitted_at), "MMM d, yyyy")
                        : format(new Date(request.created_date), "MMM d, yyyy")}
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
                    <TableHead>Fund</TableHead>
                    <TableHead>Category</TableHead>
                    <TableHead>Amount</TableHead>
                    <TableHead>Status</TableHead>
                    <TableHead>Submitted</TableHead>
                    <TableHead className="w-12"></TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {filteredRequests.map((request) => (
                    <TableRow key={request.id} className="group hover:bg-slate-50/50">
                      <TableCell>
                        <div className="flex items-center gap-2">
                          <Hash className="w-3 h-3 text-slate-400" />
                          <span className="font-mono text-sm font-medium text-indigo-600">
                            {request.request_id}
                          </span>
                        </div>
                      </TableCell>
                      <TableCell className="font-medium">{request.fund_name}</TableCell>
                      <TableCell>
                        <Badge variant="secondary" className="bg-slate-100">
                          {request.intended_use_category}
                        </Badge>
                      </TableCell>
                      <TableCell className="font-semibold">${request.requested_amount?.toLocaleString()}</TableCell>
                      <TableCell>
                        <StatusBadge status={request.status} />
                      </TableCell>
                      <TableCell className="text-slate-500">
                        {request.submitted_at
                          ? format(new Date(request.submitted_at), "MMM d, yyyy")
                          : format(new Date(request.created_date), "MMM d, yyyy")}
                      </TableCell>
                      <TableCell>
                        <Button variant="ghost" size="sm" asChild>
                          <Link to={createPageUrl(`RequestDetail?id=${request.id}`)}>
                            <Eye className="w-4 h-4" />
                          </Link>
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