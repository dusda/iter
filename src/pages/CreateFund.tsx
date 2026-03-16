import React, { useState, useEffect } from "react";
import { useNavigate } from "react-router-dom";
import { createPageUrl } from "@/utils";
import { api } from "@/api/supabaseApi";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { Button, buttonVariants } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Label } from "@/components/ui/label";
import { Switch } from "@/components/ui/switch";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import LoadingSpinner from "@/components/shared/LoadingSpinner";
import PageHeader from "@/components/shared/PageHeader";
import { DollarSign, Save, CheckCircle, ArrowLeft } from "lucide-react";
import { Link } from "react-router-dom";
import { cn } from "@/lib/utils";

type ApplicationFieldConfig = {
  enabled?: boolean;
  required?: boolean;
};

interface FundConfigFormValues {
  fund_name: string;
  description: string;
  eligibility_notes: string;
  start_date: string;
  end_date: string;
  total_budget: string;
  max_request_amount: string;
  requires_attachments: boolean;
  allowed_categories: string[];
  budget_enforcement: "none" | "warn" | "block";
  status: "active" | "inactive" | "archived";
  application_fields: {
    phone: ApplicationFieldConfig;
    intended_use_description: ApplicationFieldConfig;
    justification_paragraph: ApplicationFieldConfig;
    attachments: ApplicationFieldConfig;
  };
}

interface CurrentUser {
  id: string;
  full_name: string;
  organization_id: string;
}

const USE_CATEGORIES = [
  "Tuition/Fees", "Books/Supplies", "Housing", "Food",
  "Transportation", "Medical", "Technology", "Other"
];

const dollarsToCents = (value: string) =>
  Math.round((parseFloat(value || "0") || 0) * 100);

export default function CreateFund() {
  const navigate = useNavigate();
  const [user, setUser] = useState<CurrentUser | null>(null);
  const [formData, setFormData] = useState<FundConfigFormValues>({
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
      attachments: { enabled: true, required: false }
    }
  });
  const [submitting, setSubmitting] = useState(false);

  useEffect(() => {
    loadUser();
  }, []);

  const loadUser = async () => {
    const currentUser = await api.auth.me();
    setUser(currentUser);
  };

  const toggleCategory = (category) => {
    if (formData.allowed_categories.includes(category)) {
      setFormData({
        ...formData,
        allowed_categories: formData.allowed_categories.filter(c => c !== category)
      });
    } else {
      setFormData({
        ...formData,
        allowed_categories: [...formData.allowed_categories, category]
      });
    }
  };

  const handleSubmit = async () => {
    setSubmitting(true);

    const fundData = {
      // Ensure a non-null primary key for Fund
      id: (typeof crypto !== "undefined" && typeof crypto.randomUUID === "function")
        ? crypto.randomUUID()
        : Math.random().toString(36).slice(2),
      fund_name: formData.fund_name,
      description: formData.description,
      eligibility_notes: formData.eligibility_notes,
      start_date: formData.start_date || null,
      end_date: formData.end_date || null,
      // store in cents
      total_budget: dollarsToCents(formData.total_budget),
      remaining_budget: dollarsToCents(formData.total_budget),
      max_request_amount: formData.max_request_amount
        ? dollarsToCents(formData.max_request_amount)
        : null,
      requires_attachments: formData.requires_attachments,
      allowed_categories: formData.allowed_categories.length > 0 ? formData.allowed_categories : null,
      budget_enforcement: formData.budget_enforcement,
      status: formData.status,
      fund_owner_id: user.id,
      fund_owner_name: user.full_name,
      organization_id: user.organization_id,
      application_fields: formData.application_fields
    };

    const newFund = await api.entities.Fund.create(fundData);

    await api.entities.AuditLog.create({
      id: (typeof crypto !== "undefined" && typeof crypto.randomUUID === "function")
        ? crypto.randomUUID()
        : Math.random().toString(36).slice(2),
      organization_id: user.organization_id,
      actor_user_id: user.id,
      actor_name: user.full_name,
      action_type: "FUND_CREATED",
      entity_type: "Fund",
      entity_id: newFund.id,
      details: JSON.stringify({ 
        fund_name: formData.fund_name,
        total_budget: formData.total_budget,
        start_date: formData.start_date,
        end_date: formData.end_date
      })
    });

    navigate(createPageUrl(`FundDetail?id=${newFund.id}`));
  };

  if (!user) {
    return (
      <div className="flex items-center justify-center min-h-[60vh]">
        <LoadingSpinner size="lg" />
      </div>
    );
  }

  return (
    <div className="max-w-3xl mx-auto space-y-6">
      <div className="flex items-center gap-4">
        <Link
          to={createPageUrl("Funds")}
          className={cn(buttonVariants({ variant: "ghost", size: "sm" }), "inline-flex items-center")}
        >
          <ArrowLeft className="w-4 h-4 mr-2" />
          Back to Funds
        </Link>
      </div>

      <PageHeader
        title="Create New Fund"
        description="Set up a new fund for student assistance"
      />

      <Card className="bg-white/70 backdrop-blur-xs border-slate-200/50">
        <CardHeader>
          <CardTitle>Fund Details</CardTitle>
          <CardDescription>Configure fund settings and constraints</CardDescription>
        </CardHeader>
        <CardContent className="space-y-6">
          {/* Basic Info */}
          <div className="space-y-4">
            <h3 className="font-semibold text-slate-800">Basic Information</h3>
            
            <div className="space-y-2">
              <Label>Fund Name *</Label>
              <Input
                placeholder="e.g., Emergency Assistance Fund"
                value={formData.fund_name}
                onChange={(e) => setFormData({ ...formData, fund_name: e.target.value })}
              />
            </div>

            <div className="space-y-2">
              <Label>Description</Label>
              <Textarea
                placeholder="Describe the purpose and goals of this fund..."
                rows={3}
                value={formData.description}
                onChange={(e) => setFormData({ ...formData, description: e.target.value })}
              />
            </div>

            <div className="space-y-2">
              <Label>Eligibility Notes</Label>
              <Textarea
                placeholder="Specify eligibility requirements..."
                rows={2}
                value={formData.eligibility_notes}
                onChange={(e) => setFormData({ ...formData, eligibility_notes: e.target.value })}
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
            <h3 className="font-semibold text-slate-800">Budget Settings</h3>
            
            <div className="grid md:grid-cols-2 gap-4">
              <div className="space-y-2">
                <Label>Total Budget *</Label>
                <div className="relative">
                  <DollarSign className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-slate-400" />
                  <Input
                    type="number"
                    className="pl-9"
                    placeholder="0.00"
                    value={formData.total_budget}
                    onChange={(e) => setFormData({ ...formData, total_budget: e.target.value })}
                  />
                </div>
              </div>

              <div className="space-y-2">
                <Label>Budget Enforcement</Label>
                <Select
                  value={formData.budget_enforcement}
                  onValueChange={(value: FundConfigFormValues["budget_enforcement"]) =>
                    setFormData({ ...formData, budget_enforcement: value })
                  }
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
            <h3 className="font-semibold text-slate-800">Application Constraints</h3>
            
            <div className="space-y-2">
              <Label>Maximum Request Amount (Optional)</Label>
              <div className="relative">
                <DollarSign className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-slate-400" />
                <Input
                  type="number"
                  className="pl-9"
                  placeholder="No limit"
                  value={formData.max_request_amount}
                  onChange={(e) => setFormData({ ...formData, max_request_amount: e.target.value })}
                />
              </div>
            </div>

            <div className="flex items-center justify-between p-3 bg-slate-50 rounded-lg">
              <div>
                <Label className="text-sm">Require Attachments</Label>
                <p className="text-xs text-slate-500">Students must upload supporting documents</p>
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
                      formData.allowed_categories.includes(category)
                        ? "bg-indigo-50 border-indigo-300 text-indigo-700"
                        : ""
                    }`}
                    onClick={() => toggleCategory(category)}
                  >
                    {formData.allowed_categories.includes(category) ? (
                      <CheckCircle className="w-3 h-3 mr-2" />
                    ) : (
                      <div className="w-3 h-3 mr-2 rounded border-2 border-slate-300" />
                    )}
                    <span className="text-xs">{category.split("/")[0]}</span>
                  </Button>
                ))}
              </div>
            </div>
            </div>

            {/* Application Form Fields */}
            <div className="space-y-4 pt-4 border-t">
            <h3 className="font-semibold text-slate-800">Application Form Fields</h3>
            <p className="text-sm text-slate-500">Choose which fields appear in the student application form</p>

            <div className="space-y-3">
              <div className="p-3 bg-slate-50 rounded-lg space-y-3">
                <div className="flex items-center justify-between">
                  <div>
                    <Label className="text-sm">Phone Number</Label>
                    <p className="text-xs text-slate-500">Collect student phone number</p>
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
                    <Label className="text-xs text-slate-600">Required</Label>
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

              <div className="p-3 bg-slate-50 rounded-lg space-y-3">
                <div className="flex items-center justify-between">
                  <div>
                    <Label className="text-sm">Intended Use Description</Label>
                    <p className="text-xs text-slate-500">Detailed description of how funds will be used</p>
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
                    <Label className="text-xs text-slate-600">Required</Label>
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

              <div className="p-3 bg-slate-50 rounded-lg space-y-3">
                <div className="flex items-center justify-between">
                  <div>
                    <Label className="text-sm">Justification Paragraph</Label>
                    <p className="text-xs text-slate-500">Why the student needs this funding</p>
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
                    <Label className="text-xs text-slate-600">Required</Label>
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

              <div className="p-3 bg-slate-50 rounded-lg space-y-3">
                <div className="flex items-center justify-between">
                  <div>
                    <Label className="text-sm">Attachments</Label>
                    <p className="text-xs text-slate-500">Allow students to upload supporting documents</p>
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
                    <Label className="text-xs text-slate-600">Required</Label>
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
            <Link
              to={createPageUrl("Funds")}
              className={cn(buttonVariants({ variant: "outline" }))}
            >
              Cancel
            </Link>
            <Button
              onClick={handleSubmit}
              disabled={submitting || !formData.fund_name || !formData.total_budget}
              className="bg-indigo-600 hover:bg-indigo-700"
            >
              {submitting ? <LoadingSpinner size="sm" className="mr-2" /> : <Save className="w-4 h-4 mr-2" />}
              Create Fund
            </Button>
          </div>
        </CardContent>
      </Card>
    </div>
  );
}