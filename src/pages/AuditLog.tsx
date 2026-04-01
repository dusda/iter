import React, { useState, useEffect } from "react";
import { api } from "@/api/supabaseApi";
import { useQuery } from "@tanstack/react-query";
import PageHeader from "@/components/shared/PageHeader";
import LoadingSpinner from "@/components/shared/LoadingSpinner";
import { Card, CardContent } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Badge } from "@/components/ui/badge";
import { Search, Download, FileText, User, DollarSign, Settings, CheckCircle } from "lucide-react";
import { format } from "date-fns";

interface AuditLogRow {
  id: string;
  created_date: string;
  actor_name: string | null;
  action_type: string;
  entity_type: string;
  entity_id: string | null;
  details?: string | null;
}

interface CurrentUser {
  id: string;
  app_role: string;
}

export default function AuditLog() {
  const [user, setUser] = useState<CurrentUser | null>(null);
  const [searchTerm, setSearchTerm] = useState("");
  const [actionFilter, setActionFilter] = useState("all");
  const [entityFilter, setEntityFilter] = useState("all");

  useEffect(() => {
    loadUser();
  }, []);

  const loadUser = async () => {
    const currentUser = await api.auth.me();
    setUser(currentUser);
  };

  const { data: logs = [], isLoading } = useQuery<AuditLogRow[]>({
    queryKey: ["auditLogs"],
    queryFn: () => api.entities.AuditLog.list("-created_date", 500),
  });

  const filteredLogs = logs.filter(log => {
    const matchesSearch = 
      log.actor_name?.toLowerCase().includes(searchTerm.toLowerCase()) ||
      log.action_type?.toLowerCase().includes(searchTerm.toLowerCase()) ||
      log.entity_id?.toLowerCase().includes(searchTerm.toLowerCase());
    
    const matchesAction = actionFilter === "all" || log.action_type === actionFilter;
    const matchesEntity = entityFilter === "all" || log.entity_type === entityFilter;
    
    return matchesSearch && matchesAction && matchesEntity;
  });

  const actionTypes = [...new Set(logs.map(l => l.action_type))].sort();
  const entityTypes = [...new Set(logs.map(l => l.entity_type))].sort();

  const exportToCSV = () => {
    const csvRows = [
      ["Date", "Actor", "Action", "Entity Type", "Entity ID", "Details"]
    ];

    filteredLogs.forEach(log => {
      csvRows.push([
        format(new Date(log.created_date), "yyyy-MM-dd HH:mm:ss"),
        log.actor_name || "",
        log.action_type || "",
        log.entity_type || "",
        log.entity_id || "",
        `"${(log.details || "").replace(/"/g, '""')}"`
      ]);
    });

    const csv = csvRows.map(row => row.join(",")).join("\n");
    const blob = new Blob([csv], { type: "text/csv" });
    const url = window.URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url;
    a.download = `audit-log-${format(new Date(), "yyyy-MM-dd")}.csv`;
    a.click();
  };

  const getActionIcon = (actionType) => {
    if (actionType.includes("CREATE")) return <FileText className="w-4 h-4 text-blue-600" />;
    if (actionType.includes("UPDATE") || actionType.includes("EDIT")) return <Settings className="w-4 h-4 text-amber-600" />;
    if (actionType.includes("APPROVE")) return <CheckCircle className="w-4 h-4 text-emerald-600" />;
    if (actionType.includes("DISBURSEMENT")) return <DollarSign className="w-4 h-4 text-violet-600" />;
    return <User className="w-4 h-4 text-slate-600" />;
  };

  if (!user) {
    return (
      <div className="flex items-center justify-center min-h-[60vh]">
        <LoadingSpinner size="lg" />
      </div>
    );
  }

  if (user.app_role !== "admin" && user.app_role !== "super_admin" && user.app_role !== "fund_manager") {
    return (
      <div className="text-center py-16">
        <p className="text-slate-500">Access restricted to administrators and fund managers</p>
      </div>
    );
  }

  return (
    <div className="space-y-6">
      <PageHeader
        title="Audit Log"
        description="Track all system activities and changes"
        actions={
          <Button onClick={exportToCSV} variant="outline">
            <Download className="w-4 h-4 mr-2" />
            Export CSV
          </Button>
        }
      />

      {/* Filters */}
      <Card className="bg-white/70 backdrop-blur-xs border-slate-200/50">
        <CardContent className="p-4">
          <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
            <div className="relative">
              <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-slate-400" />
              <Input
                placeholder="Search logs..."
                className="pl-9"
                value={searchTerm}
                onChange={(e) => setSearchTerm(e.target.value)}
              />
            </div>

            <Select value={actionFilter} onValueChange={setActionFilter}>
              <SelectTrigger>
                <SelectValue placeholder="Filter by action" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="all">All Actions</SelectItem>
                {actionTypes.map(action => (
                  <SelectItem key={action} value={action}>{action}</SelectItem>
                ))}
              </SelectContent>
            </Select>

            <Select value={entityFilter} onValueChange={setEntityFilter}>
              <SelectTrigger>
                <SelectValue placeholder="Filter by entity" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="all">All Entities</SelectItem>
                {entityTypes.map(entity => (
                  <SelectItem key={entity} value={entity}>{entity}</SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>
        </CardContent>
      </Card>

      {/* Audit Log Table */}
      <Card className="bg-white/70 backdrop-blur-xs border-slate-200/50">
        <CardContent className="p-0">
          {isLoading ? (
            <LoadingSpinner className="py-16" />
          ) : (
            <div className="overflow-x-auto">
              <Table>
                <TableHeader>
                  <TableRow className="bg-slate-50/50">
                    <TableHead>Date & Time</TableHead>
                    <TableHead>Actor</TableHead>
                    <TableHead>Action</TableHead>
                    <TableHead>Entity</TableHead>
                    <TableHead>Details</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {filteredLogs.map((log) => {
                    let details = {};
                    try {
                      details = JSON.parse(log.details || "{}");
                    } catch (e) {
                      details = { raw: log.details };
                    }

                    return (
                      <TableRow key={log.id} className="hover:bg-slate-50/50">
                        <TableCell className="text-sm">
                          {format(new Date(log.created_date), "MMM d, yyyy")}
                          <br />
                          <span className="text-xs text-slate-500">
                            {format(new Date(log.created_date), "h:mm a")}
                          </span>
                        </TableCell>
                        <TableCell>
                          <p className="font-medium text-sm">{log.actor_name}</p>
                        </TableCell>
                        <TableCell>
                          <div className="flex items-center gap-2">
                            {getActionIcon(log.action_type)}
                            <Badge variant="outline" className="text-xs">
                              {log.action_type}
                            </Badge>
                          </div>
                        </TableCell>
                        <TableCell>
                          <div className="text-sm">
                            <p className="font-medium">{log.entity_type}</p>
                            {log.entity_id && (
                              <p className="text-xs text-slate-500 font-mono">{log.entity_id.substring(0, 8)}...</p>
                            )}
                          </div>
                        </TableCell>
                        <TableCell className="max-w-xs">
                          <div className="text-xs text-slate-600 space-y-1">
                            {Object.entries(details).slice(0, 3).map(([key, value]) => (
                              <div key={key}>
                                <span className="font-medium">{key}:</span>{" "}
                                <span className="text-slate-500">
                                  {typeof value === "string" ? value.substring(0, 50) : JSON.stringify(value).substring(0, 50)}
                                </span>
                              </div>
                            ))}
                          </div>
                        </TableCell>
                      </TableRow>
                    );
                  })}
                </TableBody>
              </Table>
            </div>
          )}
        </CardContent>
      </Card>
    </div>
  );
}