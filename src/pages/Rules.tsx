import React, { useState, useEffect } from "react";
import { api } from "@/api/supabaseApi";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import PageHeader from "@/components/shared/PageHeader";
import LoadingSpinner from "@/components/shared/LoadingSpinner";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Badge } from "@/components/ui/badge";
import { Alert, AlertDescription } from "@/components/ui/alert";
import { GitBranch, Plus, Settings, AlertCircle } from "lucide-react";
import RuleBuilder from "@/components/rules/RuleBuilder";
import { normalizeStringArray } from "@/utils";

export default function Rules() {
  const [selectedFundId, setSelectedFundId] = useState("");
  const [showBuilder, setShowBuilder] = useState(false);
  const queryClient = useQueryClient();

  const { data: user, isLoading: userLoading } = useQuery({
    queryKey: ["me"],
    queryFn: () => api.auth.me(),
  });

  const { data: funds = [] } = useQuery({
    queryKey: ["funds", user?.organization_id],
    enabled: !!user?.organization_id,
    queryFn: () =>
      api.entities.Fund.filter({ organization_id: user.organization_id }, "-created_date"),
  });

  const { data: rules = [] } = useQuery({
    queryKey: ["fundRules", selectedFundId],
    queryFn: () => api.entities.RoutingRule.filter({ fund_id: selectedFundId }, "step_order"),
    enabled: !!selectedFundId,
  });

  const selectedFund = funds.find(f => f.id === selectedFundId);

  if (userLoading || !user) {
    return (
      <div className="flex items-center justify-center min-h-[60vh]">
        <LoadingSpinner size="lg" />
      </div>
    );
  }

  return (
    <div className="max-w-5xl mx-auto space-y-6">
      <PageHeader
        title="Routing Rules"
        description="Configure review workflows and approval routing for funds"
      />

      {/* Fund Selector */}
      <Card className="bg-white/70 backdrop-blur-xs border-slate-200/50 dark:bg-slate-900/70 dark:border-slate-800/50">
        <CardContent className="p-6">
          <div className="flex items-center gap-4">
            <div className="flex-1">
              <label className="text-sm font-medium text-slate-700 mb-2 block dark:text-slate-200">
                Select Fund
              </label>
              <Select value={selectedFundId} onValueChange={setSelectedFundId}>
                <SelectTrigger>
                  <SelectValue placeholder="Choose a fund to configure..." />
                </SelectTrigger>
                <SelectContent>
                  {funds.map((fund) => (
                    <SelectItem key={fund.id} value={fund.id}>
                      {fund.fund_name}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
            {selectedFundId && (
              <Button
                onClick={() => setShowBuilder(true)}
                className="bg-indigo-600 hover:bg-indigo-700 mt-6 text-white"
              >
                <Plus className="w-4 h-4 mr-2" />
                Add Step
              </Button>
            )}
          </div>
        </CardContent>
      </Card>

      {selectedFundId && (
        <>
          {/* Rules Overview */}
          {rules.length === 0 ? (
            <Card className="bg-white/70 backdrop-blur-xs border-slate-200/50 dark:bg-slate-900/70 dark:border-slate-800/50">
              <CardContent className="py-16">
                <div className="text-center">
                  <GitBranch className="w-16 h-16 text-slate-300 mx-auto mb-4" />
                  <h3 className="text-lg font-semibold text-slate-800 mb-2 dark:text-slate-100">
                    No Routing Rules Configured
                  </h3>
                  <p className="text-slate-500 mb-6 dark:text-slate-400">
                    Set up review steps to define the approval workflow for {selectedFund?.fund_name}
                  </p>
                  <Button onClick={() => setShowBuilder(true)} className="bg-indigo-600 hover:bg-indigo-700 text-white">
                    <Plus className="w-4 h-4 mr-2" />
                    Create First Step
                  </Button>
                </div>
              </CardContent>
            </Card>
          ) : (
            <Card className="bg-white/70 backdrop-blur-xs border-slate-200/50 dark:bg-slate-900/70 dark:border-slate-800/50">
              <CardHeader>
                <CardTitle className="flex items-center gap-2">
                  <GitBranch className="w-5 h-5" />
                  Review Workflow for {selectedFund?.fund_name}
                </CardTitle>
              </CardHeader>
              <CardContent className="space-y-4">
                {rules.map((rule, index) => {
                  const ruleCategories = normalizeStringArray(rule.applicable_categories);
                  return (
                  <div key={rule.id} className="relative">
                    {/* Step Card */}
                    <div className="flex items-start gap-4 p-4 bg-slate-50 rounded-lg border border-slate-200 dark:bg-slate-900 dark:border-slate-800">
                      {/* Step Number */}
                      <div className="shrink-0">
                        <div className="w-10 h-10 rounded-full bg-indigo-600 text-white flex items-center justify-center font-bold">
                          {rule.step_order}
                        </div>
                      </div>

                      {/* Step Details */}
                      <div className="flex-1 min-w-0">
                        <div className="flex items-center gap-2 mb-2">
                          <h4 className="font-semibold text-slate-800 dark:text-slate-100">{rule.step_name}</h4>
                          <Badge variant={rule.permissions === "approve_deny" ? "default" : "secondary"}>
                            {rule.permissions === "approve_deny" ? "Can Approve/Deny" : "Recommend Only"}
                          </Badge>
                          {!rule.is_active && <Badge variant="outline">Inactive</Badge>}
                        </div>

                        <div className="grid md:grid-cols-2 gap-3 text-sm">
                          <div>
                            <span className="text-slate-500 dark:text-slate-400">Role queue:</span>
                            <p className="font-medium">
                              {rule.assigned_to_type === "by_category"
                                ? "By category (legacy)"
                                : (rule.assigned_role || "reviewer")}
                            </p>
                          </div>

                          {(rule.min_amount != null || rule.max_amount != null) && (
                            <div>
                              <span className="text-slate-500 dark:text-slate-400">Amount Range:</span>
                              <p className="font-medium">
                                {rule.min_amount != null &&
                                  `≥ $${(Number(rule.min_amount) / 100).toLocaleString()}`}
                                {rule.min_amount != null && rule.max_amount != null && " - "}
                                {rule.max_amount != null &&
                                  `≤ $${(Number(rule.max_amount) / 100).toLocaleString()}`}
                              </p>
                            </div>
                          )}

                          {ruleCategories.length > 0 && (
                            <div>
                              <span className="text-slate-500 dark:text-slate-400">Categories:</span>
                              <div className="flex flex-wrap gap-1 mt-1">
                                {ruleCategories.map((cat) => (
                                  <Badge key={cat} variant="outline" className="text-xs">
                                    {cat}
                                  </Badge>
                                ))}
                              </div>
                            </div>
                          )}

                          {rule.sla_target_days && (
                            <div>
                              <span className="text-slate-500 dark:text-slate-400">SLA Target:</span>
                              <p className="font-medium">{rule.sla_target_days} days</p>
                            </div>
                          )}
                        </div>
                      </div>

                      {/* Actions */}
                      <Button
                        variant="ghost"
                        size="sm"
                        onClick={() => setShowBuilder(rule)}
                      >
                        <Settings className="w-4 h-4" />
                      </Button>
                    </div>

                    {/* Connector Arrow */}
                    {index < rules.length - 1 && (
                      <div className="flex justify-center py-2">
                        <div className="w-px h-6 bg-slate-300"></div>
                      </div>
                    )}
                  </div>
                  );
                })}
              </CardContent>
            </Card>
          )}

          {/* Info Alert */}
          <Alert className="bg-blue-50 border-blue-200 dark:bg-blue-950/30 dark:border-blue-900/50">
            <AlertCircle className="w-4 h-4 text-blue-600 dark:text-blue-400" />
            <AlertDescription className="text-blue-800 text-sm dark:text-blue-200">
              <strong>How it works:</strong> When a student submits a request, the system evaluates all active rules based on the requested amount and category. Matching steps are assigned in order, and reviewers can only act on their assigned step once the previous step is complete.
            </AlertDescription>
          </Alert>
        </>
      )}

      {/* Rule Builder Modal/Sheet */}
      {showBuilder && (
        <RuleBuilder
          fundId={selectedFundId}
          fundName={selectedFund?.fund_name}
          organizationId={selectedFund?.organization_id ?? user.organization_id}
          rule={typeof showBuilder === "object" ? showBuilder : null}
          existingSteps={rules.length}
          onClose={() => {
            setShowBuilder(false);
            queryClient.invalidateQueries({ queryKey: ["fundRules", selectedFundId] });
          }}
        />
      )}
    </div>
  );
}