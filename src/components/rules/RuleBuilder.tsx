import React, { useState } from "react";
import { api } from "@/api/supabaseApi";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogDescription,
} from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Switch } from "@/components/ui/switch";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { Badge } from "@/components/ui/badge";
import LoadingSpinner from "@/components/shared/LoadingSpinner";
import { toast } from "@/components/ui/use-toast";
import { normalizeStringArray } from "@/utils";
import { Save, Trash2, X, CheckCircle } from "lucide-react";

const USE_CATEGORIES = [
  "Tuition/Fees", "Books/Supplies", "Housing", "Food",
  "Transportation", "Medical", "Technology", "Other"
];

interface RuleBuilderProps {
  fundId: string;
  fundName: string;
  /** Required for inserts; should match the fund's organization. */
  organizationId: string | null | undefined;
  rule?: any;
  existingSteps: number;
  onClose: () => void;
}

export default function RuleBuilder({
  fundId,
  fundName,
  organizationId,
  rule,
  existingSteps,
  onClose,
}: RuleBuilderProps) {
  const [formData, setFormData] = useState({
    step_order: rule?.step_order || existingSteps + 1,
    step_name: rule?.step_name || "",
    assigned_role: rule?.assigned_role || "reviewer",
    min_amount:
      rule?.min_amount != null && rule.min_amount !== ""
        ? String(Number(rule.min_amount) / 100)
        : "",
    max_amount:
      rule?.max_amount != null && rule.max_amount !== ""
        ? String(Number(rule.max_amount) / 100)
        : "",
    applicable_categories: normalizeStringArray(rule?.applicable_categories),
    sla_target_days: rule?.sla_target_days?.toString() || "",
    permissions: rule?.permissions || "approve_deny",
    is_active: rule?.is_active ?? true,
  });
  const [submitting, setSubmitting] = useState(false);
  const [deleting, setDeleting] = useState(false);

  const toggleCategory = (category: string) => {
    if (formData.applicable_categories.includes(category)) {
      setFormData({
        ...formData,
        applicable_categories: formData.applicable_categories.filter(c => c !== category)
      });
    } else {
      setFormData({
        ...formData,
        applicable_categories: [...formData.applicable_categories, category]
      });
    }
  };

  const handleSave = async () => {
    setSubmitting(true);

    const currentUser = await api.auth.me();

    const orgId = organizationId ?? rule?.organization_id;
    if (!orgId) {
      setSubmitting(false);
      toast({
        title: "Cannot save rule",
        description: "Organization is missing. Reload the page or contact support.",
        variant: "destructive",
      });
      return;
    }

    const ruleData = {
      organization_id: orgId,
      fund_id: fundId,
      fund_name: fundName,
      step_order: parseInt(formData.step_order),
      step_name: formData.step_name,
      assigned_to_type: "role_queue",
      assigned_role: formData.assigned_role,
      assigned_user_ids: null,
      assigned_user_names: null,
      min_amount: formData.min_amount ? Math.round(parseFloat(formData.min_amount) * 100) : null,
      max_amount: formData.max_amount ? Math.round(parseFloat(formData.max_amount) * 100) : null,
      applicable_categories: formData.applicable_categories.length > 0 ? formData.applicable_categories : null,
      sla_target_days: formData.sla_target_days ? parseInt(formData.sla_target_days) : null,
      permissions: formData.permissions,
      is_active: formData.is_active
    };

    if (rule) {
      await api.entities.RoutingRule.update(rule.id, ruleData);
      await api.entities.AuditLog.create({
        organization_id: orgId,
        actor_user_id: currentUser.id,
        actor_name: currentUser.full_name,
        action_type: "RULE_UPDATED",
        entity_type: "RoutingRule",
        entity_id: rule.id,
        details: JSON.stringify({ 
          fund_name: fundName,
          step_name: formData.step_name,
          step_order: formData.step_order
        })
      });
    } else {
      const newRule = await api.entities.RoutingRule.create(ruleData);
      await api.entities.AuditLog.create({
        organization_id: orgId,
        actor_user_id: currentUser.id,
        actor_name: currentUser.full_name,
        action_type: "RULE_CREATED",
        entity_type: "RoutingRule",
        entity_id: newRule.id,
        details: JSON.stringify({ 
          fund_name: fundName,
          step_name: formData.step_name,
          step_order: formData.step_order
        })
      });
    }

    setSubmitting(false);
    onClose();
  };

  const handleDelete = async () => {
    if (!confirm("Are you sure you want to delete this rule?")) return;
    const orgId = organizationId ?? rule?.organization_id;
    if (!orgId) {
      toast({
        title: "Cannot delete rule",
        description: "Organization is missing. Reload the page or contact support.",
        variant: "destructive",
      });
      return;
    }

    setDeleting(true);

    try {
      const currentUser = await api.auth.me();

      await api.entities.AuditLog.create({
        organization_id: orgId,
        actor_user_id: currentUser.id,
        actor_name: currentUser.full_name,
        action_type: "RULE_DELETED",
        entity_type: "RoutingRule",
        entity_id: rule.id,
        details: JSON.stringify({
          fund_name: fundName,
          step_name: rule.step_name,
          step_order: rule.step_order
        })
      });

      await api.entities.RoutingRule.delete(rule.id);
      onClose();
    } finally {
      setDeleting(false);
    }
  };

  return (
    <Dialog open={true} onOpenChange={onClose}>
      <DialogContent className="max-w-2xl max-h-[90vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle>{rule ? "Edit" : "Create"} Review Step</DialogTitle>
          <DialogDescription>
            Configure a review step for {fundName}
          </DialogDescription>
        </DialogHeader>

        <div className="space-y-6 py-4">
          {/* Basic Info */}
          <div className="space-y-4">
            <div className="grid grid-cols-2 gap-4">
              <div className="space-y-2">
                <Label>Step Order *</Label>
                <Input
                  type="number"
                  min="1"
                  value={formData.step_order}
                  onChange={(e) => setFormData({ ...formData, step_order: e.target.value })}
                />
              </div>
              <div className="space-y-2">
                <Label>Step Name *</Label>
                <Input
                  placeholder="e.g., Initial Review"
                  value={formData.step_name}
                  onChange={(e) => setFormData({ ...formData, step_name: e.target.value })}
                />
              </div>
            </div>
          </div>

          {/* Role queue: any org member with this app role may complete the step */}
          <div className="space-y-4 pt-4 border-t">
            <h3 className="font-semibold text-slate-800 dark:text-slate-100">Role queue</h3>
            <div className="space-y-2">
              <Label>Role *</Label>
              <Select
                value={formData.assigned_role}
                onValueChange={(value) => setFormData({ ...formData, assigned_role: value })}
              >
                <SelectTrigger>
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="reviewer">Reviewer</SelectItem>
                  <SelectItem value="approver">Approver</SelectItem>
                  <SelectItem value="fund_manager">Fund Manager</SelectItem>
                  <SelectItem value="admin">Admin</SelectItem>
                </SelectContent>
              </Select>
            </div>
          </div>

          {/* Conditions */}
          <div className="space-y-4 pt-4 border-t">
            <h3 className="font-semibold text-slate-800 dark:text-slate-100">Conditions (Optional)</h3>
            
            <div className="grid grid-cols-2 gap-4">
              <div className="space-y-2">
                <Label>Minimum Amount</Label>
                <Input
                  type="number"
                  placeholder="No minimum"
                  value={formData.min_amount}
                  onChange={(e) => setFormData({ ...formData, min_amount: e.target.value })}
                />
              </div>
              <div className="space-y-2">
                <Label>Maximum Amount</Label>
                <Input
                  type="number"
                  placeholder="No maximum"
                  value={formData.max_amount}
                  onChange={(e) => setFormData({ ...formData, max_amount: e.target.value })}
                />
              </div>
            </div>

            <div className="space-y-2">
              <Label>Applicable Categories (Leave empty for all)</Label>
              <div className="grid grid-cols-2 gap-2">
                {USE_CATEGORIES.map((category) => (
                  <Button
                    key={category}
                    type="button"
                    variant="outline"
                    size="sm"
                    className={`justify-start ${
                      formData.applicable_categories.includes(category)
                        ? "bg-indigo-50 border-indigo-300 text-indigo-700 dark:bg-indigo-950/30 dark:border-indigo-800/60 dark:text-indigo-300"
                        : ""
                    }`}
                    onClick={() => toggleCategory(category)}
                  >
                    {formData.applicable_categories.includes(category) ? (
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

          {/* Settings */}
          <div className="space-y-4 pt-4 border-t">
            <h3 className="font-semibold text-slate-800 dark:text-slate-100">Settings</h3>
            
            <div className="space-y-2">
              <Label>SLA Target Days</Label>
              <Input
                type="number"
                placeholder="Optional"
                value={formData.sla_target_days}
                onChange={(e) => setFormData({ ...formData, sla_target_days: e.target.value })}
              />
            </div>

            <div className="space-y-2">
              <Label>Permissions</Label>
              <Select
                value={formData.permissions}
                onValueChange={(value) => setFormData({ ...formData, permissions: value })}
              >
                <SelectTrigger>
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="approve_deny">Can Approve/Deny</SelectItem>
                  <SelectItem value="recommend_only">Recommend Only</SelectItem>
                </SelectContent>
              </Select>
            </div>

            <div className="flex items-center justify-between p-3 bg-slate-50 rounded-lg dark:bg-slate-900">
              <div>
                <Label className="text-sm">Active</Label>
                <p className="text-xs text-slate-500 dark:text-slate-400">Enable this rule for new requests</p>
              </div>
              <Switch
                checked={formData.is_active}
                onCheckedChange={(checked) => setFormData({ ...formData, is_active: checked })}
              />
            </div>
          </div>
        </div>

        {/* Actions */}
        <div className="flex justify-between pt-4 border-t">
          {rule && (
            <Button
              variant="destructive"
              onClick={handleDelete}
              disabled={deleting}
            >
              {deleting ? <LoadingSpinner size="sm" className="mr-2" /> : <Trash2 className="w-4 h-4 mr-2" />}
              Delete
            </Button>
          )}
          <div className="flex gap-3 ml-auto">
            <Button variant="outline" onClick={onClose}>
              <X className="w-4 h-4 mr-2" />
              Cancel
            </Button>
            <Button
              onClick={handleSave}
              disabled={
                submitting ||
                !formData.step_name ||
                !(organizationId ?? rule?.organization_id)
              }
              className="bg-indigo-600 hover:bg-indigo-700"
            >
              {submitting ? <LoadingSpinner size="sm" className="mr-2" /> : <Save className="w-4 h-4 mr-2" />}
              Save Rule
            </Button>
          </div>
        </div>
      </DialogContent>
    </Dialog>
  );
}