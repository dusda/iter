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
import { Tabs, TabsList, TabsTrigger } from "@/components/ui/tabs";
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
  Wallet,
  Plus,
  Search,
  MoreHorizontal,
  Eye,
  Archive,
  Users,
  TrendingDown,
  DollarSign
} from "lucide-react";

export default function Funds() {
  const [user, setUser] = useState(null);
  const [searchTerm, setSearchTerm] = useState("");
  const [statusFilter, setStatusFilter] = useState("active");

  useEffect(() => {
    loadUser();
  }, []);

  const loadUser = async () => {
    const currentUser = await api.auth.me();
    setUser(currentUser);
  };

  const { data: funds = [], isLoading } = useQuery({
    queryKey: ["allFunds"],
    queryFn: () => api.entities.Fund.list("-created_date"),
  });

  const { data: requests = [] } = useQuery({
    queryKey: ["allRequests"],
    queryFn: () => api.entities.FundRequest.list(),
  });

  const { data: disbursements = [] } = useQuery({
    queryKey: ["allDisbursements"],
    queryFn: () => api.entities.Disbursement.list(),
  });

  const calculateBudgetStats = (fundId) => {
    const fundRequests = requests.filter(r => r.fund_id === fundId);
    const fundDisbursements = disbursements.filter(d => d.fund_id === fundId);
    
    const paid = fundDisbursements.reduce((sum, d) => sum + (d.amount_paid || 0), 0);
    const approved = fundRequests
      .filter(r => r.status === "Approved")
      .reduce((sum, r) => sum + (r.requested_amount || 0), 0);
    
    return { paid, approved };
  };

  const filteredFunds = funds.filter((fund) => {
    const matchesSearch = fund.fund_name?.toLowerCase().includes(searchTerm.toLowerCase());
    const matchesStatus = statusFilter === "all" || fund.status === statusFilter;
    return matchesSearch && matchesStatus;
  });

  const statusCounts = {
    all: funds.length,
    active: funds.filter(f => f.status === "active").length,
    inactive: funds.filter(f => f.status === "inactive").length,
    archived: funds.filter(f => f.status === "archived").length,
  };

  const canManageFunds = user?.app_role === "fund_manager" || user?.app_role === "admin";

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
        title="Fund Management"
        description="Create and manage funds for student assistance"
        actions={
          canManageFunds && (
            <Button asChild className="bg-gradient-to-r from-indigo-600 to-violet-600 hover:from-indigo-700 hover:to-violet-700">
              <Link to={createPageUrl("CreateFund")}>
                <Plus className="w-4 h-4 mr-2" />
                Create Fund
              </Link>
            </Button>
          )
        }
      />

      {/* Status Tabs */}
      <Tabs value={statusFilter} onValueChange={setStatusFilter}>
        <TabsList className="bg-white/70 border">
          <TabsTrigger value="all" className="data-[state=active]:bg-indigo-600 data-[state=active]:text-white">
            All ({statusCounts.all})
          </TabsTrigger>
          <TabsTrigger value="active" className="data-[state=active]:bg-emerald-600 data-[state=active]:text-white">
            Active ({statusCounts.active})
          </TabsTrigger>
          <TabsTrigger value="inactive" className="data-[state=active]:bg-slate-600 data-[state=active]:text-white">
            Inactive ({statusCounts.inactive})
          </TabsTrigger>
          <TabsTrigger value="archived" className="data-[state=active]:bg-amber-600 data-[state=active]:text-white">
            Archived ({statusCounts.archived})
          </TabsTrigger>
        </TabsList>
      </Tabs>

      {/* Search */}
      <Card className="bg-white/70 backdrop-blur-sm border-slate-200/50">
        <CardContent className="p-4">
          <div className="relative">
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-slate-400" />
            <Input
              placeholder="Search funds..."
              className="pl-9"
              value={searchTerm}
              onChange={(e) => setSearchTerm(e.target.value)}
            />
          </div>
        </CardContent>
      </Card>

      {/* Funds Table */}
      {isLoading ? (
        <LoadingSpinner className="py-16" />
      ) : filteredFunds.length === 0 ? (
        <EmptyState
          icon={Wallet}
          title="No Funds Found"
          description={funds.length === 0 ? "Create your first fund to get started." : "No funds match your filters."}
          action={
            funds.length === 0 && canManageFunds && (
              <Button asChild className="mt-4">
                <Link to={createPageUrl("CreateFund")}>
                  <Plus className="w-4 h-4 mr-2" />
                  Create Fund
                </Link>
              </Button>
            )
          }
        />
      ) : (
        <Card className="bg-white/70 backdrop-blur-sm border-slate-200/50 overflow-hidden">
          {/* Mobile View */}
          <div className="md:hidden divide-y">
            {filteredFunds.map((fund) => {
              const stats = calculateBudgetStats(fund.id);
              const remaining = (fund.total_budget || 0) - stats.paid - stats.approved;
              
              return (
                <div key={fund.id} className="p-4">
                  <div className="flex items-start justify-between mb-3">
                    <div className="flex-1">
                      <h3 className="font-semibold text-slate-800">{fund.fund_name}</h3>
                      <p className="text-sm text-slate-500">{fund.fund_owner_name}</p>
                    </div>
                    <StatusBadge status={fund.status} />
                  </div>
                  <div className="grid grid-cols-2 gap-3 text-sm mb-3">
                    <div>
                      <p className="text-slate-500">Budget</p>
                      <p className="font-semibold">${fund.total_budget?.toLocaleString()}</p>
                    </div>
                    <div>
                      <p className="text-slate-500">Paid</p>
                      <p className="font-semibold text-violet-600">${stats.paid.toLocaleString()}</p>
                    </div>
                    <div>
                      <p className="text-slate-500">Committed</p>
                      <p className="font-semibold text-amber-600">${stats.approved.toLocaleString()}</p>
                    </div>
                    <div>
                      <p className="text-slate-500">Remaining</p>
                      <p className="font-semibold text-emerald-600">${remaining.toLocaleString()}</p>
                    </div>
                  </div>
                  <Button asChild variant="outline" size="sm" className="w-full">
                    <Link to={createPageUrl(`FundDetail?id=${fund.id}`)}>
                      <Eye className="w-4 h-4 mr-2" />
                      View Details
                    </Link>
                  </Button>
                </div>
              );
            })}
          </div>

          {/* Desktop View */}
          <div className="hidden md:block">
            <Table>
              <TableHeader>
                <TableRow className="bg-slate-50/50">
                  <TableHead>Fund Name</TableHead>
                  <TableHead>Owner</TableHead>
                  <TableHead className="text-right">Budget</TableHead>
                  <TableHead className="text-right">Paid</TableHead>
                  <TableHead className="text-right">Committed</TableHead>
                  <TableHead className="text-right">Remaining</TableHead>
                  <TableHead>Status</TableHead>
                  <TableHead className="w-20">Actions</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {filteredFunds.map((fund) => {
                  const stats = calculateBudgetStats(fund.id);
                  const remaining = (fund.total_budget || 0) - stats.paid - stats.approved;
                  const percentRemaining = ((remaining / (fund.total_budget || 1)) * 100);
                  
                  return (
                    <TableRow key={fund.id} className="hover:bg-slate-50/50">
                      <TableCell>
                        <div>
                          <p className="font-semibold">{fund.fund_name}</p>
                          {fund.description && (
                            <p className="text-sm text-slate-500 line-clamp-1">{fund.description}</p>
                          )}
                        </div>
                      </TableCell>
                      <TableCell>
                        <div className="flex items-center gap-2 text-sm">
                          <Users className="w-4 h-4 text-slate-400" />
                          {fund.fund_owner_name || "Unknown"}
                        </div>
                      </TableCell>
                      <TableCell className="text-right font-medium">
                        ${fund.total_budget?.toLocaleString()}
                      </TableCell>
                      <TableCell className="text-right">
                        <div className="flex flex-col items-end">
                          <span className="font-medium text-violet-600">${stats.paid.toLocaleString()}</span>
                          <span className="text-xs text-slate-400">
                            {((stats.paid / (fund.total_budget || 1)) * 100).toFixed(0)}%
                          </span>
                        </div>
                      </TableCell>
                      <TableCell className="text-right">
                        <div className="flex flex-col items-end">
                          <span className="font-medium text-amber-600">${stats.approved.toLocaleString()}</span>
                          <span className="text-xs text-slate-400">
                            {((stats.approved / (fund.total_budget || 1)) * 100).toFixed(0)}%
                          </span>
                        </div>
                      </TableCell>
                      <TableCell className="text-right">
                        <div className="flex flex-col items-end">
                          <span className={`font-medium ${
                            percentRemaining < 20 ? "text-red-600" : 
                            percentRemaining < 50 ? "text-amber-600" : 
                            "text-emerald-600"
                          }`}>
                            ${remaining.toLocaleString()}
                          </span>
                          <div className="flex items-center gap-1">
                            {percentRemaining < 20 && <TrendingDown className="w-3 h-3 text-red-500" />}
                            <span className="text-xs text-slate-400">
                              {percentRemaining.toFixed(0)}%
                            </span>
                          </div>
                        </div>
                      </TableCell>
                      <TableCell>
                        <StatusBadge status={fund.status} />
                      </TableCell>
                      <TableCell>
                        <DropdownMenu>
                          <DropdownMenuTrigger asChild>
                            <Button variant="ghost" size="sm">
                              <MoreHorizontal className="w-4 h-4" />
                            </Button>
                          </DropdownMenuTrigger>
                          <DropdownMenuContent align="end">
                            <DropdownMenuItem asChild>
                              <Link to={createPageUrl(`FundDetail?id=${fund.id}`)}>
                                <Eye className="w-4 h-4 mr-2" /> View Details
                              </Link>
                            </DropdownMenuItem>
                            {fund.status !== "archived" && (
                              <DropdownMenuItem asChild>
                                <Link to={createPageUrl(`FundDetail?id=${fund.id}&edit=true`)}>
                                  <DollarSign className="w-4 h-4 mr-2" /> Edit Fund
                                </Link>
                              </DropdownMenuItem>
                            )}
                            {fund.status !== "archived" && (
                              <DropdownMenuItem className="text-amber-600">
                                <Archive className="w-4 h-4 mr-2" /> Archive
                              </DropdownMenuItem>
                            )}
                          </DropdownMenuContent>
                        </DropdownMenu>
                      </TableCell>
                    </TableRow>
                  );
                })}
              </TableBody>
            </Table>
          </div>
        </Card>
      )}
    </div>
  );
}