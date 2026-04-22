import React, { useState, useEffect } from "react";
import { Link, Navigate, useNavigate } from "react-router-dom";
import { createPageUrl } from "@/utils";
import { api } from "@/api/supabaseApi";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import PageHeader from "@/components/shared/PageHeader";
import StatusBadge from "@/components/shared/StatusBadge";
import LoadingSpinner from "@/components/shared/LoadingSpinner";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Label } from "@/components/ui/label";
import { Switch } from "@/components/ui/switch";
import { Badge } from "@/components/ui/badge";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import {
  Alert,
  AlertDescription,
} from "@/components/ui/alert";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import {
  ArrowLeft,
  Save,
  Edit,
  DollarSign,
  TrendingUp,
  TrendingDown,
  FileText,
  Calendar,
  AlertTriangle,
  CheckCircle,
  X
} from "lucide-react";
import { format } from "date-fns";

type ApplicationFieldConfig = {
  enabled?: boolean;
  required?: boolean;
};

interface FundConfig {
  id: string;
  organization_id: string;
  fund_name: string;
  description?: string | null;
  eligibility_notes?: string | null;
  start_date?: string | null;
  end_date?: string | null;
  total_budget: number;
  max_request_amount?: number | null;
  requires_attachments: boolean;
  allowed_categories?: string[] | null;
  budget_enforcement: "none" | "warn" | "block";
  status: "active" | "inactive" | "archived";
  fund_owner_name?: string | null;
  remaining_budget?: number | null;
  application_fields?: {
    phone?: ApplicationFieldConfig;
    intended_use_description?: ApplicationFieldConfig;
    justification_paragraph?: ApplicationFieldConfig;
    attachments?: ApplicationFieldConfig;
  };
  created_date: string;
}

interface FundRequestSummary {
  id: string;
  student_full_name: string;
  requested_amount: number;
  status: string;
  created_date: string;
}

interface DisbursementRow {
  id: string;
  amount_paid: number;
  fund_id: string;
  fund_name: string;
}

interface CurrentUser {
  id: string;
  full_name: string;
  organization_id: string;
  app_role?: string;
}

const USE_CATEGORIES = [
  "Tuition/Fees",
  "Books/Supplies",
  "Housing",
  "Food",
  "Transportation",
  "Medical",
  "Technology",
  "Other"
];

const centsToNumber = (cents?: number | null) =>
  cents != null ? cents / 100 : 0;

const dollarsToCents = (value: string) =>
  Math.round((parseFloat(value || "0") || 0) * 100);

export default function FundDetail() {
  const navigate = useNavigate();
  const queryClient = useQueryClient();
  const [user, setUser] = useState<CurrentUser | null>(null);
  const urlParams = new URLSearchParams(window.location.search);
  const fundId = urlParams.get("id");
  const editMode = urlParams.get("edit") === "true";
  const [isEditing, setIsEditing] = useState(editMode);
  const [formData, setFormData] = useState<any>({
    fund_name: "",
    description: "",
    eligibility_notes: "",
    start_date: "",
    end_date: "",
    total_budget: "",
    max_request_amount: "",
    requires_attachments: false,
    allowed_categories: [],
    budget_enforcement: "warn",
    status: "active",
    application_fields: {
      phone: { enabled: true, required: false },
      intended_use_description: { enabled: true, required: true },
      justification_paragraph: { enabled: true, required: true },
      attachments: { enabled: true, required: false },
    },
  });
  const [submitting, setSubmitting] = useState(false);

  useEffect(() => {
    loadUser();
  }, []);

  const loadUser = async () => {
    const currentUser = await api.auth.me();
    setUser(currentUser);
  };

  const { data: fund, isLoading } = useQuery<FundConfig | undefined>({
    queryKey: ["fund", fundId],
    queryFn: () => api.entities.Fund.filter({ id: fundId }).then(res => res[0] as FundConfig | undefined),
    enabled: !!fundId,
  });

  const { data: requests = [] } = useQuery<FundRequestSummary[]>({
    queryKey: ["fundRequests", fundId],
    queryFn: () => api.entities.FundRequest.filter({ fund_id: fundId }),
    enabled: !!fundId,
  });

  const { data: disbursements = [] } = useQuery<DisbursementRow[]>({
    queryKey: ["fundDisbursements", fundId],
    queryFn: () => api.entities.Disbursement.filter({ fund_id: fundId }),
    enabled: !!fundId,
  });

  useEffect(() => {
    if (fund) {
      setFormData({
        ...fund,
        description: fund.description || "",
        eligibility_notes: fund.eligibility_notes || "",
        start_date: fund.start_date || "",
        end_date: fund.end_date || "",
        total_budget: fund.total_budget != null ? (centsToNumber(fund.total_budget)).toString() : "",
        max_request_amount: fund.max_request_amount != null ? (centsToNumber(fund.max_request_amount)).toString() : "",
        requires_attachments: fund.requires_attachments || false,
        allowed_categories: fund.allowed_categories || [],
        budget_enforcement: fund.budget_enforcement || "warn",
        application_fields: fund.application_fields || {
          phone: { enabled: true, required: false },
          intended_use_description: { enabled: true, required: true },
          justification_paragraph: { enabled: true, required: true },
          attachments: { enabled: true, required: false },
        },
      });
    }
  }, [fund]);

  const calculateBudgetStats = () => {
    const paid = disbursements.reduce((sum, d) => sum + (d.amount_paid || 0), 0);
    const approved = requests
      .filter(r => r.status === "Approved")
      .reduce((sum, r) => sum + (r.requested_amount || 0), 0);
    const totalBudget = fund?.total_budget || 0;
    const remaining = totalBudget - paid - approved;
    
    return { paid, approved, remaining, totalBudget };
  };

  const handleSave = async () => {
    setSubmitting(true);

    const updateData = {
      fund_name: formData.fund_name,
      description: formData.description,
      eligibility_notes: formData.eligibility_notes,
      start_date: formData.start_date || null,
      end_date: formData.end_date || null,
      total_budget: dollarsToCents(formData.total_budget),
      max_request_amount: formData.max_request_amount ? dollarsToCents(formData.max_request_amount) : null,
      requires_attachments: formData.requires_attachments,
      allowed_categories: formData.allowed_categories,
      budget_enforcement: formData.budget_enforcement,
      status: formData.status,
      application_fields: formData.application_fields
    };

    await api.entities.Fund.update(fundId, updateData);

    // Create audit log
    await api.entities.AuditLog.create({
      // Ensure we always send a non-null primary key
      id: (typeof crypto !== "undefined" && typeof crypto.randomUUID === "function")
        ? crypto.randomUUID()
        : Math.random().toString(36).slice(2),
      // Use the organization from the current user (or fall back to the fund)
      organization_id: user.organization_id || fund.organization_id,
      actor_user_id: user.id,
      actor_name: user.full_name,
      action_type: "FUND_UPDATED",
      entity_type: "Fund",
      entity_id: fundId,
      details: JSON.stringify({ fund_name: formData.fund_name })
    });

    queryClient.invalidateQueries({ queryKey: ["fund", fundId] });
    queryClient.invalidateQueries({ queryKey: ["funds"] });
    setIsEditing(false);
    setSubmitting(false);
  };

  const toggleCategory = (category) => {
    const current = formData.allowed_categories || [];
    if (current.includes(category)) {
      setFormData({
        ...formData,
        allowed_categories: current.filter(c => c !== category)
      });
    } else {
      setFormData({
        ...formData,
        allowed_categories: [...current, category]
      });
    }
  };

  if (isLoading || !user) {
    return (
      <div className="flex items-center justify-center min-h-[60vh]">
        <LoadingSpinner size="lg" />
      </div>
    );
  }

  if (user.app_role === "reviewer") {
    return <Navigate to={createPageUrl("Home")} replace />;
  }

  if (!fund) {
    return (
      <div className="text-center py-16">
        <p className="text-slate-500 dark:text-slate-400">Fund not found</p>
        <Button asChild className="mt-4">
          <Link to={createPageUrl("Funds")}>Back to Funds</Link>
        </Button>
      </div>
    );
  }

  const stats = calculateBudgetStats();
  const percentPaid = stats.totalBudget ? (stats.paid / stats.totalBudget) * 100 : 0;
  const percentCommitted = stats.totalBudget ? (stats.approved / stats.totalBudget) * 100 : 0;
  const percentRemaining = stats.totalBudget ? (stats.remaining / stats.totalBudget) * 100 : 0;

  return (
    <div className="max-w-6xl mx-auto space-y-6">
      <div className="flex items-center gap-4">
        <Button variant="ghost" size="sm" asChild>
          <Link to={createPageUrl("Funds")}>
            <ArrowLeft className="w-4 h-4 mr-2" />
            Back to Funds
          </Link>
        </Button>
      </div>

      <PageHeader
        title={isEditing ? "Edit Fund" : fund.fund_name}
        description={isEditing ? "Update fund details and constraints" : fund.description}
        actions={
          !isEditing && (
            <Button onClick={() => setIsEditing(true)} className="bg-indigo-600 hover:bg-indigo-700">
              <Edit className="w-4 h-4 mr-2" />
              Edit Fund
            </Button>
          )
        }
      />

      {/* Budget Stats */}
      <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
        <Card className="bg-white/70 backdrop-blur-xs border-slate-200/50 dark:bg-slate-900/70 dark:border-slate-800/50">
          <CardContent className="p-6">
            <div className="flex items-center justify-between mb-2">
              <p className="text-sm text-slate-500 dark:text-slate-400">Total Budget</p>
              <DollarSign className="w-5 h-5 text-indigo-200" />
            </div>
            <p className="text-2xl font-bold text-slate-900 dark:text-slate-50">
              ${centsToNumber(stats.totalBudget).toLocaleString()}
            </p>
          </CardContent>
        </Card>

        <Card className="bg-white/70 backdrop-blur-xs border-slate-200/50 dark:bg-slate-900/70 dark:border-slate-800/50">
          <CardContent className="p-6">
            <div className="flex items-center justify-between mb-2">
              <p className="text-sm text-slate-500 dark:text-slate-400">Paid</p>
              <TrendingDown className="w-5 h-5 text-violet-200" />
            </div>
            <p className="text-2xl font-bold text-violet-600">
              ${centsToNumber(stats.paid).toLocaleString()}
            </p>
            <p className="text-xs text-slate-400 mt-1 dark:text-slate-500">{percentPaid.toFixed(1)}% of budget</p>
          </CardContent>
        </Card>

        <Card className="bg-white/70 backdrop-blur-xs border-slate-200/50 dark:bg-slate-900/70 dark:border-slate-800/50">
          <CardContent className="p-6">
            <div className="flex items-center justify-between mb-2">
              <p className="text-sm text-slate-500 dark:text-slate-400">Committed</p>
              <FileText className="w-5 h-5 text-amber-200" />
            </div>
            <p className="text-2xl font-bold text-amber-600">
              ${centsToNumber(stats.approved).toLocaleString()}
            </p>
            <p className="text-xs text-slate-400 mt-1 dark:text-slate-500">{percentCommitted.toFixed(1)}% of budget</p>
          </CardContent>
        </Card>

        <Card className="bg-white/70 backdrop-blur-xs border-slate-200/50 dark:bg-slate-900/70 dark:border-slate-800/50">
          <CardContent className="p-6">
            <div className="flex items-center justify-between mb-2">
              <p className="text-sm text-slate-500 dark:text-slate-400">Remaining</p>
              <TrendingUp className="w-5 h-5 text-emerald-200" />
            </div>
            <p className={`text-2xl font-bold ${
              percentRemaining < 20 ? "text-red-600" :
              percentRemaining < 50 ? "text-amber-600" :
              "text-emerald-600"
            }`}>
              ${centsToNumber(stats.remaining).toLocaleString()}
            </p>
            <p className="text-xs text-slate-400 mt-1 dark:text-slate-500">{percentRemaining.toFixed(1)}% remaining</p>
          </CardContent>
        </Card>
      </div>

      {/* Budget Progress */}
      <Card className="bg-white/70 backdrop-blur-xs border-slate-200/50 dark:bg-slate-900/70 dark:border-slate-800/50">
        <CardHeader>
          <CardTitle className="text-lg">Budget Utilization</CardTitle>
        </CardHeader>
        <CardContent>
          <div className="space-y-3">
            <div className="h-8 bg-slate-100 rounded-full overflow-hidden flex dark:bg-slate-800">
              {percentPaid > 0 && (
                <div 
                  className="bg-violet-500 flex items-center justify-center text-white text-xs font-medium"
                  style={{ width: `${percentPaid}%` }}
                >
                  {percentPaid > 5 && `Paid ${percentPaid.toFixed(0)}%`}
                </div>
              )}
              {percentCommitted > 0 && (
                <div 
                  className="bg-amber-500 flex items-center justify-center text-white text-xs font-medium"
                  style={{ width: `${percentCommitted}%` }}
                >
                  {percentCommitted > 5 && `Committed ${percentCommitted.toFixed(0)}%`}
                </div>
              )}
            </div>
            <div className="flex items-center justify-between text-sm">
              <div className="flex items-center gap-4">
                <div className="flex items-center gap-2">
                  <div className="w-3 h-3 bg-violet-500 rounded-sm"></div>
                  <span>Paid: ${stats.paid.toLocaleString()}</span>
                </div>
                <div className="flex items-center gap-2">
                  <div className="w-3 h-3 bg-amber-500 rounded-sm"></div>
                  <span>Committed: ${stats.approved.toLocaleString()}</span>
                </div>
                <div className="flex items-center gap-2">
                  <div className="w-3 h-3 bg-emerald-500 rounded-sm"></div>
                  <span>Remaining: ${stats.remaining.toLocaleString()}</span>
                </div>
              </div>
            </div>
          </div>
        </CardContent>
      </Card>

      {isEditing ? (
        /* Edit Mode */
        <Card className="bg-white/70 backdrop-blur-xs border-slate-200/50 dark:bg-slate-900/70 dark:border-slate-800/50">
          <CardHeader>
            <CardTitle>Fund Details</CardTitle>
            <CardDescription>Update fund information and constraints</CardDescription>
          </CardHeader>
          <CardContent className="space-y-6">
            {/* Basic Info */}
            <div className="space-y-4">
              <h3 className="font-semibold text-slate-800 dark:text-slate-100">Basic Information</h3>
              
              <div className="grid md:grid-cols-2 gap-4">
                <div className="space-y-2">
                  <Label>Fund Name *</Label>
                  <Input
                    value={formData.fund_name}
                    onChange={(e) => setFormData({ ...formData, fund_name: e.target.value })}
                  />
                </div>

                <div className="space-y-2">
                  <Label>Status</Label>
                  <Select
                    value={formData.status}
                    onValueChange={(value) => setFormData({ ...formData, status: value })}
                  >
                    <SelectTrigger>
                      <SelectValue />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="active">Active</SelectItem>
                      <SelectItem value="inactive">Inactive</SelectItem>
                      <SelectItem value="archived">Archived</SelectItem>
                    </SelectContent>
                  </Select>
                </div>
              </div>

              <div className="space-y-2">
                <Label>Description</Label>
                <Textarea
                  value={formData.description}
                  onChange={(e) => setFormData({ ...formData, description: e.target.value })}
                  rows={3}
                />
              </div>

              <div className="space-y-2">
                <Label>Eligibility Notes</Label>
                <Textarea
                  value={formData.eligibility_notes}
                  onChange={(e) => setFormData({ ...formData, eligibility_notes: e.target.value })}
                  rows={2}
                />
              </div>

              <div className="grid md:grid-cols-2 gap-4">
                <div className="space-y-2">
                  <Label>Start Date</Label>
                  <Input
                    type="date"
                    value={formData.start_date}
                    onChange={(e) => setFormData({ ...formData, start_date: e.target.value })}
                  />
                </div>

                <div className="space-y-2">
                  <Label>End Date</Label>
                  <Input
                    type="date"
                    value={formData.end_date}
                    onChange={(e) => setFormData({ ...formData, end_date: e.target.value })}
                  />
                </div>
              </div>
            </div>

            {/* Budget Settings */}
            <div className="space-y-4 pt-4 border-t">
              <h3 className="font-semibold text-slate-800 dark:text-slate-100">Budget Settings</h3>
              
              <div className="grid md:grid-cols-2 gap-4">
                <div className="space-y-2">
                  <Label>Total Budget *</Label>
                  <div className="relative">
                    <DollarSign className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-slate-400 dark:text-slate-500" />
                    <Input
                      type="number"
                      className="pl-9"
                      value={formData.total_budget}
                      onChange={(e) => setFormData({ ...formData, total_budget: e.target.value })}
                    />
                  </div>
                </div>

                <div className="space-y-2">
                  <Label>Budget Enforcement</Label>
                  <Select
                    value={formData.budget_enforcement}
                    onValueChange={(value) => setFormData({ ...formData, budget_enforcement: value })}
                  >
                    <SelectTrigger>
                      <SelectValue />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="none">None (No restrictions)</SelectItem>
                      <SelectItem value="warn">Warn (Show warning)</SelectItem>
                      <SelectItem value="block">Block (Prevent approval)</SelectItem>
                    </SelectContent>
                  </Select>
                </div>
              </div>
            </div>

            {/* Constraints */}
            <div className="space-y-4 pt-4 border-t">
              <h3 className="font-semibold text-slate-800 dark:text-slate-100">Application Constraints</h3>
              
              <div className="space-y-2">
                <Label>Maximum Request Amount (Optional)</Label>
                <div className="relative">
                  <DollarSign className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-slate-400 dark:text-slate-500" />
                  <Input
                    type="number"
                    className="pl-9"
                    placeholder="No limit"
                    value={formData.max_request_amount}
                    onChange={(e) => setFormData({ ...formData, max_request_amount: e.target.value })}
                  />
                </div>
              </div>

              <div className="flex items-center justify-between p-3 bg-slate-50 rounded-lg dark:bg-slate-900">
                <div>
                  <Label className="text-sm">Require Attachments</Label>
                  <p className="text-xs text-slate-500 dark:text-slate-400">Students must upload supporting documents</p>
                </div>
                <Switch
                  checked={formData.requires_attachments}
                  onCheckedChange={(checked) => setFormData({ ...formData, requires_attachments: checked })}
                />
              </div>

              <div className="space-y-2">
                <Label>Allowed Categories (Leave empty for all)</Label>
                <div className="grid grid-cols-2 md:grid-cols-4 gap-2">
                  {USE_CATEGORIES.map((category) => (
                    <Button
                      key={category}
                      type="button"
                      variant="outline"
                      size="sm"
                      className={`justify-start ${
                        (formData.allowed_categories || []).includes(category)
                          ? "bg-indigo-50 border-indigo-300 text-indigo-700"
                          : ""
                      }`}
                      onClick={() => toggleCategory(category)}
                    >
                      {(formData.allowed_categories || []).includes(category) ? (
                        <CheckCircle className="w-3 h-3 mr-2" />
                      ) : (
                        <div className="w-3 h-3 mr-2 rounded border-2 border-slate-300 dark:border-slate-700" />
                      )}
                      <span className="text-xs">{category.split("/")[0]}</span>
                    </Button>
                  ))}
                </div>
              </div>
            </div>

            {/* Application Form Fields */}
            <div className="space-y-4 pt-4 border-t">
              <h3 className="font-semibold text-slate-800 dark:text-slate-100">Application Form Fields</h3>
              <p className="text-sm text-slate-500 dark:text-slate-400">Choose which fields appear in the student application form</p>
              
              <div className="space-y-3">
                <div className="p-3 bg-slate-50 rounded-lg space-y-3 dark:bg-slate-900">
                  <div className="flex items-center justify-between">
                    <div>
                      <Label className="text-sm">Phone Number</Label>
                      <p className="text-xs text-slate-500 dark:text-slate-400">Collect student phone number</p>
                    </div>
                    <Switch
                      checked={formData.application_fields?.phone?.enabled ?? true}
                      onCheckedChange={(checked) => setFormData({ 
                        ...formData, 
                        application_fields: { 
                          ...formData.application_fields, 
                          phone: { ...(formData.application_fields?.phone || {}), enabled: checked }
                        }
                      })}
                    />
                  </div>
                  {(formData.application_fields?.phone?.enabled ?? true) && (
                    <div className="flex items-center justify-between pl-4 pt-2 border-t">
                      <Label className="text-xs text-slate-600 dark:text-slate-300">Required</Label>
                      <Switch
                        checked={formData.application_fields?.phone?.required ?? false}
                        onCheckedChange={(checked) => setFormData({ 
                          ...formData, 
                          application_fields: { 
                            ...formData.application_fields, 
                            phone: { ...(formData.application_fields?.phone || {}), required: checked }
                          }
                        })}
                      />
                    </div>
                  )}
                </div>

                <div className="p-3 bg-slate-50 rounded-lg space-y-3 dark:bg-slate-900">
                  <div className="flex items-center justify-between">
                    <div>
                      <Label className="text-sm">Intended Use Description</Label>
                      <p className="text-xs text-slate-500 dark:text-slate-400">Detailed description of how funds will be used</p>
                    </div>
                    <Switch
                      checked={formData.application_fields?.intended_use_description?.enabled ?? true}
                      onCheckedChange={(checked) => setFormData({ 
                        ...formData, 
                        application_fields: { 
                          ...formData.application_fields, 
                          intended_use_description: { ...(formData.application_fields?.intended_use_description || {}), enabled: checked }
                        }
                      })}
                    />
                  </div>
                  {(formData.application_fields?.intended_use_description?.enabled ?? true) && (
                    <div className="flex items-center justify-between pl-4 pt-2 border-t">
                      <Label className="text-xs text-slate-600 dark:text-slate-300">Required</Label>
                      <Switch
                        checked={formData.application_fields?.intended_use_description?.required ?? true}
                        onCheckedChange={(checked) => setFormData({ 
                          ...formData, 
                          application_fields: { 
                            ...formData.application_fields, 
                            intended_use_description: { ...(formData.application_fields?.intended_use_description || {}), required: checked }
                          }
                        })}
                      />
                    </div>
                  )}
                </div>

                <div className="p-3 bg-slate-50 rounded-lg space-y-3 dark:bg-slate-900">
                  <div className="flex items-center justify-between">
                    <div>
                      <Label className="text-sm">Justification Paragraph</Label>
                      <p className="text-xs text-slate-500 dark:text-slate-400">Why the student needs this funding</p>
                    </div>
                    <Switch
                      checked={formData.application_fields?.justification_paragraph?.enabled ?? true}
                      onCheckedChange={(checked) => setFormData({ 
                        ...formData, 
                        application_fields: { 
                          ...formData.application_fields, 
                          justification_paragraph: { ...(formData.application_fields?.justification_paragraph || {}), enabled: checked }
                        }
                      })}
                    />
                  </div>
                  {(formData.application_fields?.justification_paragraph?.enabled ?? true) && (
                    <div className="flex items-center justify-between pl-4 pt-2 border-t">
                      <Label className="text-xs text-slate-600 dark:text-slate-300">Required</Label>
                      <Switch
                        checked={formData.application_fields?.justification_paragraph?.required ?? true}
                        onCheckedChange={(checked) => setFormData({ 
                          ...formData, 
                          application_fields: { 
                            ...formData.application_fields, 
                            justification_paragraph: { ...(formData.application_fields?.justification_paragraph || {}), required: checked }
                          }
                        })}
                      />
                    </div>
                  )}
                </div>

                <div className="p-3 bg-slate-50 rounded-lg space-y-3 dark:bg-slate-900">
                  <div className="flex items-center justify-between">
                    <div>
                      <Label className="text-sm">Attachments</Label>
                      <p className="text-xs text-slate-500 dark:text-slate-400">Allow students to upload supporting documents</p>
                    </div>
                    <Switch
                      checked={formData.application_fields?.attachments?.enabled ?? true}
                      onCheckedChange={(checked) => setFormData({ 
                        ...formData, 
                        application_fields: { 
                          ...formData.application_fields, 
                          attachments: { ...(formData.application_fields?.attachments || {}), enabled: checked }
                        }
                      })}
                    />
                  </div>
                  {(formData.application_fields?.attachments?.enabled ?? true) && (
                    <div className="flex items-center justify-between pl-4 pt-2 border-t">
                      <Label className="text-xs text-slate-600 dark:text-slate-300">Required</Label>
                      <Switch
                        checked={formData.application_fields?.attachments?.required ?? false}
                        onCheckedChange={(checked) => setFormData({ 
                          ...formData, 
                          application_fields: { 
                            ...formData.application_fields, 
                            attachments: { ...(formData.application_fields?.attachments || {}), required: checked }
                          }
                        })}
                      />
                    </div>
                  )}
                </div>
              </div>
            </div>

            {/* Actions */}
            <div className="flex justify-end gap-3 pt-4 border-t">
              <Button
                variant="outline"
                onClick={() => {
                  if (!fund) return;
                  setIsEditing(false);
                  setFormData({
                    ...fund,
                    description: fund.description || "",
                    eligibility_notes: fund.eligibility_notes || "",
                    start_date: fund.start_date || "",
                    end_date: fund.end_date || "",
                    total_budget: fund.total_budget?.toString() || "",
                    max_request_amount: fund.max_request_amount?.toString() || "",
                    requires_attachments: fund.requires_attachments || false,
                    allowed_categories: fund.allowed_categories || [],
                    budget_enforcement: fund.budget_enforcement || "warn",
                    application_fields: fund.application_fields || {
                      phone: { enabled: true, required: false },
                      intended_use_description: { enabled: true, required: true },
                      justification_paragraph: { enabled: true, required: true },
                      attachments: { enabled: true, required: false },
                    },
                  });
                }}
              >
                <X className="w-4 h-4 mr-2" />
                Cancel
              </Button>
              <Button
                onClick={handleSave}
                disabled={submitting || !formData.fund_name || !formData.total_budget}
                className="bg-indigo-600 hover:bg-indigo-700"
              >
                {submitting ? <LoadingSpinner size="sm" className="mr-2" /> : <Save className="w-4 h-4 mr-2" />}
                Save Changes
              </Button>
            </div>
          </CardContent>
        </Card>
      ) : (
        /* View Mode */
        <div className="grid lg:grid-cols-3 gap-6">
          <div className="lg:col-span-2 space-y-6">
            {/* Fund Info */}
            <Card className="bg-white/70 backdrop-blur-xs border-slate-200/50 dark:bg-slate-900/70 dark:border-slate-800/50">
              <CardHeader>
                <CardTitle className="text-lg">Fund Information</CardTitle>
              </CardHeader>
              <CardContent className="space-y-4">
                {fund.description && (
                  <div>
                    <p className="text-sm font-medium text-slate-500 mb-1 dark:text-slate-400">Description</p>
                    <p className="text-slate-700 dark:text-slate-200">{fund.description}</p>
                  </div>
                )}
                {fund.eligibility_notes && (
                  <div>
                    <p className="text-sm font-medium text-slate-500 mb-1 dark:text-slate-400">Eligibility</p>
                    <Alert className="bg-blue-50 border-blue-200">
                      <AlertDescription className="text-blue-800 text-sm">
                        {fund.eligibility_notes}
                      </AlertDescription>
                    </Alert>
                  </div>
                )}
                <div className="grid md:grid-cols-2 gap-4 pt-2">
                  {fund.start_date && (
                    <div>
                      <p className="text-sm font-medium text-slate-500 mb-1 dark:text-slate-400">Start Date</p>
                      <p className="flex items-center gap-2">
                        <Calendar className="w-4 h-4 text-slate-400 dark:text-slate-500" />
                        {format(new Date(fund.start_date), "MMMM d, yyyy")}
                      </p>
                    </div>
                  )}
                  {fund.end_date && (
                    <div>
                      <p className="text-sm font-medium text-slate-500 mb-1 dark:text-slate-400">End Date</p>
                      <p className="flex items-center gap-2">
                        <Calendar className="w-4 h-4 text-slate-400 dark:text-slate-500" />
                        {format(new Date(fund.end_date), "MMMM d, yyyy")}
                      </p>
                    </div>
                  )}
                </div>
              </CardContent>
            </Card>

            {/* Recent Requests */}
            <Card className="bg-white/70 backdrop-blur-xs border-slate-200/50 dark:bg-slate-900/70 dark:border-slate-800/50">
              <CardHeader>
                <div className="flex items-center justify-between">
                  <CardTitle className="text-lg">Recent Requests</CardTitle>
                  <Badge variant="secondary">{requests.length} total</Badge>
                </div>
              </CardHeader>
              <CardContent>
                {requests.length === 0 ? (
                  <p className="text-center text-slate-500 py-8 dark:text-slate-400">No requests yet</p>
                ) : (
                  <Table>
                    <TableHeader>
                      <TableRow>
                        <TableHead>Student</TableHead>
                        <TableHead>Amount</TableHead>
                        <TableHead>Status</TableHead>
                        <TableHead>Date</TableHead>
                      </TableRow>
                    </TableHeader>
                    <TableBody>
                      {requests.slice(0, 5).map((request) => (
                        <TableRow key={request.id}>
                          <TableCell className="font-medium">{request.student_full_name}</TableCell>
                          <TableCell>${request.requested_amount?.toLocaleString()}</TableCell>
                          <TableCell><StatusBadge status={request.status} /></TableCell>
                          <TableCell className="text-slate-500 text-sm dark:text-slate-400">
                            {format(new Date(request.created_date), "MMM d")}
                          </TableCell>
                        </TableRow>
                      ))}
                    </TableBody>
                  </Table>
                )}
              </CardContent>
            </Card>
          </div>

          {/* Sidebar */}
          <div className="space-y-6">
            {/* Constraints */}
            <Card className="bg-white/70 backdrop-blur-xs border-slate-200/50 dark:bg-slate-900/70 dark:border-slate-800/50">
              <CardHeader>
                <CardTitle className="text-lg">Constraints</CardTitle>
              </CardHeader>
              <CardContent className="space-y-3 text-sm">
                <div className="flex justify-between">
                  <span className="text-slate-500 dark:text-slate-400">Max Request</span>
                  <span className="font-medium">
                    {fund.max_request_amount ? `$${centsToNumber(fund.max_request_amount).toLocaleString()}` : "No limit"}
                  </span>
                </div>
                <div className="flex justify-between">
                  <span className="text-slate-500 dark:text-slate-400">Attachments Required</span>
                  <span className="font-medium">
                    {fund.requires_attachments ? "Yes" : "No"}
                  </span>
                </div>
                <div className="flex justify-between">
                  <span className="text-slate-500 dark:text-slate-400">Budget Enforcement</span>
                  <Badge variant={
                    fund.budget_enforcement === "block" ? "destructive" :
                    fund.budget_enforcement === "warn" ? "secondary" : "outline"
                  }>
                    {fund.budget_enforcement || "None"}
                  </Badge>
                </div>
                {Array.isArray(fund.allowed_categories) && fund.allowed_categories.length > 0 && (
                  <div>
                    <p className="text-slate-500 mb-2 dark:text-slate-400">Allowed Categories</p>
                    <div className="flex flex-wrap gap-1">
                      {fund.allowed_categories.map((cat) => (
                        <Badge key={cat} variant="outline" className="text-xs">
                          {cat}
                        </Badge>
                      ))}
                    </div>
                  </div>
                )}
              </CardContent>
            </Card>

            {/* Fund Owner */}
            <Card className="bg-white/70 backdrop-blur-xs border-slate-200/50 dark:bg-slate-900/70 dark:border-slate-800/50">
              <CardHeader>
                <CardTitle className="text-lg">Fund Owner</CardTitle>
              </CardHeader>
              <CardContent>
                <p className="font-medium">{fund.fund_owner_name || "Unknown"}</p>
                <p className="text-sm text-slate-500 mt-1 dark:text-slate-400">Fund Manager</p>
              </CardContent>
            </Card>

            {/* Warning if low budget */}
            {percentRemaining < 20 && (
              <Alert className="bg-red-50 border-red-200">
                <AlertTriangle className="w-4 h-4 text-red-600" />
                <AlertDescription className="text-red-800 text-sm">
                  <strong>Low Budget Warning</strong>
                  <p className="mt-1">Only {percentRemaining.toFixed(0)}% of the budget remains.</p>
                </AlertDescription>
              </Alert>
            )}
          </div>
        </div>
      )}
    </div>
  );
}