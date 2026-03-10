import React, { useState, useEffect } from "react";
import { Link, useNavigate } from "react-router-dom";
import { createPageUrl } from "@/utils";
import { base44 } from "@/api/base44Client";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import PageHeader from "@/components/shared/PageHeader";
import StatusBadge from "@/components/shared/StatusBadge";
import LoadingSpinner from "@/components/shared/LoadingSpinner";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Textarea } from "@/components/ui/textarea";
import { Label } from "@/components/ui/label";
import { Input } from "@/components/ui/input";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Badge } from "@/components/ui/badge";
import AttachmentList from "@/components/shared/AttachmentList";
import {
  ArrowLeft,
  FileText,
  Calendar,
  DollarSign,
  User,
  Send,
  ExternalLink,
  MessageSquare,
  Clock,
  CheckCircle,
  XCircle,
  AlertCircle,
  CreditCard,
  Upload
} from "lucide-react";
import { format } from "date-fns";

export default function ReviewRequest() {
  const navigate = useNavigate();
  const queryClient = useQueryClient();
  const [user, setUser] = useState(null);
  const [reviewComments, setReviewComments] = useState("");
  const [decision, setDecision] = useState("");
  const [submitting, setSubmitting] = useState(false);
  const [showDisbursementModal, setShowDisbursementModal] = useState(false);
  const [disbursementData, setDisbursementData] = useState({
    amount_paid: "",
    paid_at: format(new Date(), "yyyy-MM-dd"),
    payment_method: "",
    notes: "",
    receipt_upload: ""
  });

  const urlParams = new URLSearchParams(window.location.search);
  const requestId = urlParams.get("id");

  useEffect(() => {
    loadUser();
  }, []);

  const loadUser = async () => {
    const currentUser = await base44.auth.me();
    setUser(currentUser);
  };

  const { data: request, isLoading } = useQuery({
    queryKey: ["fundRequest", requestId],
    queryFn: () => base44.entities.FundRequest.filter({ id: requestId }).then(res => res[0]),
    enabled: !!requestId,
  });

  const { data: reviews = [] } = useQuery({
    queryKey: ["reviews", requestId],
    queryFn: () => base44.entities.Review.filter({ fund_request_id: requestId }, "step_order"),
    enabled: !!requestId,
  });

  const { data: disbursements = [] } = useQuery({
    queryKey: ["disbursements", requestId],
    queryFn: () => base44.entities.Disbursement.filter({ fund_request_id: requestId }),
    enabled: !!requestId,
  });

  const { data: fund } = useQuery({
    queryKey: ["fund", request?.fund_id],
    queryFn: () => base44.entities.Fund.filter({ id: request.fund_id }).then(res => res[0]),
    enabled: !!request?.fund_id,
  });

  const submitReview = async () => {
    if (!currentReview) return;

    // Require comment for Deny decision
    if (decision === "Denied" && !reviewComments.trim()) {
      alert("Please provide a reason for denying this request.");
      return;
    }

    // Require message for Needs Info
    if (decision === "Needs Info" && !reviewComments.trim()) {
      alert("Please provide details about what information is needed.");
      return;
    }

    setSubmitting(true);

    // Check budget before approving (only for final approval)
    if (decision === "Approved" && fund && isFinalStep) {
      const approvedRequests = await base44.entities.FundRequest.filter({ 
        fund_id: fund.id, 
        status: "Approved" 
      });
      const committedAmount = approvedRequests.reduce((sum, r) => sum + (r.requested_amount || 0), 0);
      
      const fundDisbursements = await base44.entities.Disbursement.filter({ fund_id: fund.id });
      const paidAmount = fundDisbursements.reduce((sum, d) => sum + (d.amount_paid || 0), 0);
      
      const remaining = fund.total_budget - paidAmount - committedAmount;
      
      if (remaining < request.requested_amount) {
        if (fund.budget_enforcement === "block") {
          alert(`Cannot approve: Insufficient budget. Remaining: $${remaining.toLocaleString()}, Requested: $${request.requested_amount.toLocaleString()}`);
          setSubmitting(false);
          return;
        } else if (fund.budget_enforcement === "warn") {
          if (!confirm(`Warning: This approval will exceed the remaining budget by $${(request.requested_amount - remaining).toLocaleString()}. Continue?`)) {
            setSubmitting(false);
            return;
          }
        }
      }
    }

    // Update current review record
    await base44.entities.Review.update(currentReview.id, {
      decision: currentReview.permissions === "recommend_only" ? "Recommended" : decision,
      comments: reviewComments,
      decided_at: new Date().toISOString()
    });

    let newStatus = request.status;
    let nextStepOrder = null;

    // Determine new status
    if (decision === "Denied") {
      // Any denial stops the workflow
      newStatus = "Denied";
    } else if (decision === "Needs Info") {
      // Needs info pauses the workflow
      newStatus = "Needs Info";
    } else if (decision === "Approved" || currentReview.permissions === "recommend_only") {
      // Check if this is the final step
      const allStepReviews = reviews.filter(r => r.step_order === currentReview.step_order);
      const allCompleted = allStepReviews.every(r => 
        r.id === currentReview.id || ["Approved", "Recommended"].includes(r.decision)
      );

      if (allCompleted && isFinalStep) {
        // Final step approved - mark as Approved
        newStatus = "Approved";
      } else if (allCompleted) {
        // Move to next step
        nextStepOrder = currentReview.step_order + 1;
        const nextStepReviews = reviews.filter(r => r.step_order === nextStepOrder);
        if (nextStepReviews.length > 0) {
          newStatus = "In Review";
        } else {
          // No more steps, approve
          newStatus = "Approved";
        }
      } else {
        // Stay in current step
        newStatus = "In Review";
      }
    }

    // Update request
    await base44.entities.FundRequest.update(requestId, {
      status: newStatus,
      current_step_order: nextStepOrder || request.current_step_order,
      current_step: nextStepOrder 
        ? reviews.find(r => r.step_order === nextStepOrder)?.step_name 
        : request.current_step,
      locked: decision === "Denied"
    });

    // Create audit log
    await base44.entities.AuditLog.create({
      organization_id: request.organization_id,
      actor_user_id: user.id,
      actor_name: user.full_name,
      action_type: `REVIEW_${decision.toUpperCase().replace(" ", "_")}`,
      entity_type: "FundRequest",
      entity_id: requestId,
      details: JSON.stringify({ 
        decision, 
        comments: reviewComments,
        step: currentReview.step_name,
        new_status: newStatus
      })
    });

    // Notify student
    const notificationTypes = {
      "Approved": { type: "approved", title: "Request Approved! 🎉", emailSubject: "Fund Request Approved" },
      "Denied": { type: "denied", title: "Request Decision", emailSubject: "Fund Request Update" },
      "Needs Info": { type: "needs_info", title: "Additional Information Needed", emailSubject: "Action Required: Fund Request" }
    };

    const notifConfig = notificationTypes[decision];
    if (notifConfig && (decision === "Approved" || decision === "Denied" || decision === "Needs Info")) {
      const isFullyApproved = newStatus === "Approved";
      
      let message = "";
      let emailBody = "";

      if (decision === "Needs Info") {
        message = `Your application for ${request.fund_name} needs additional information. ${reviewComments}`;
        emailBody = `Dear ${request.student_full_name},\n\nWe need more information about your fund request (${request.request_id}).\n\n${reviewComments}\n\nPlease update your application with the requested information.\n\nBest regards,\nStudent Funds Team`;
      } else if (decision === "Approved" && isFullyApproved) {
        message = `Your application for ${request.fund_name} has been approved for $${request.requested_amount.toLocaleString()}!`;
        emailBody = `Dear ${request.student_full_name},\n\nGreat news! Your fund request (${request.request_id}) has been approved.\n\nFund: ${request.fund_name}\nAmount: $${request.requested_amount.toLocaleString()}\n\nPayment will be processed shortly.\n\nBest regards,\nStudent Funds Team`;
      } else if (decision === "Denied") {
        message = `Your application for ${request.fund_name} was not approved. ${reviewComments}`;
        emailBody = `Dear ${request.student_full_name},\n\nWe regret to inform you that your fund request (${request.request_id}) was not approved.\n\n${reviewComments}\n\nYou may submit a new application if circumstances change.\n\nBest regards,\nStudent Funds Team`;
      }

      if (message) {
        await base44.entities.Notification.create({
          organization_id: request.organization_id,
          user_id: request.student_user_id,
          user_email: request.student_email,
          type: notifConfig.type,
          title: notifConfig.title,
          message: message,
          link: createPageUrl(`RequestDetail?id=${requestId}`),
          related_entity_type: "FundRequest",
          related_entity_id: requestId,
          email_sent: true
        });

        await base44.integrations.Core.SendEmail({
          to: request.student_email,
          subject: `${notifConfig.emailSubject} - ${request.request_id}`,
          body: emailBody
        });
      }
    }

    queryClient.invalidateQueries(["fundRequest", requestId]);
    queryClient.invalidateQueries(["reviews", requestId]);
    queryClient.invalidateQueries(["allRequests"]);
    queryClient.invalidateQueries(["allReviews"]);
    setReviewComments("");
    setDecision("");
    setSubmitting(false);
  };

  const handleReceiptUpload = async (e) => {
    const file = e.target.files?.[0];
    if (!file) return;

    const { file_url } = await base44.integrations.Core.UploadFile({ file });
    setDisbursementData({ ...disbursementData, receipt_upload: file_url });
  };

  const submitDisbursement = async () => {
    setSubmitting(true);

    const amountPaid = parseFloat(disbursementData.amount_paid);

    await base44.entities.Disbursement.create({
      fund_request_id: requestId,
      fund_id: request.fund_id,
      fund_name: request.fund_name,
      student_name: request.student_full_name,
      amount_paid: amountPaid,
      paid_at: disbursementData.paid_at || new Date().toISOString(),
      payment_method: disbursementData.payment_method,
      notes: disbursementData.notes,
      receipt_upload: disbursementData.receipt_upload
    });

    // Calculate total disbursed for this request (new record already saved above)
    const allDisbursements = await base44.entities.Disbursement.filter({ fund_request_id: requestId });
    const totalDisbursed = allDisbursements.reduce((sum, d) => sum + (d.amount_paid || 0), 0);

    // Update request status based on disbursement
    const newStatus = totalDisbursed >= request.requested_amount ? "Paid" : "Approved";
    await base44.entities.FundRequest.update(requestId, {
      status: newStatus
    });

    // Update fund remaining budget
    if (fund) {
      const newRemaining = (fund.remaining_budget || fund.total_budget) - amountPaid;
      await base44.entities.Fund.update(fund.id, {
        remaining_budget: newRemaining
      });
    }

    // Create audit log
    await base44.entities.AuditLog.create({
      organization_id: request.organization_id,
      actor_user_id: user.id,
      actor_name: user.full_name,
      action_type: "DISBURSEMENT_CREATED",
      entity_type: "Disbursement",
      entity_id: requestId,
      details: JSON.stringify({ 
        amount_paid: amountPaid,
        payment_method: disbursementData.payment_method,
        total_disbursed: totalDisbursed,
        requested_amount: request.requested_amount,
        new_status: newStatus
      })
    });

    // Notify student about payment
    const isPaidInFull = newStatus === "Paid";
    await base44.entities.Notification.create({
      organization_id: request.organization_id,
      user_id: request.student_user_id,
      user_email: request.student_email,
      type: "paid",
      title: isPaidInFull ? "Payment Processed ✓" : "Partial Payment Processed",
      message: `${isPaidInFull ? "Your full payment" : `A payment of $${amountPaid.toLocaleString()}`} for ${request.fund_name} has been processed via ${disbursementData.payment_method}.`,
      link: createPageUrl(`RequestDetail?id=${requestId}`),
      related_entity_type: "FundRequest",
      related_entity_id: requestId,
      email_sent: true
    });

    await base44.integrations.Core.SendEmail({
      to: request.student_email,
      subject: `${isPaidInFull ? "Payment Processed" : "Partial Payment Processed"} - ${request.request_id}`,
      body: `Dear ${request.student_full_name},\n\n${isPaidInFull ? "Your full payment" : `A payment of $${amountPaid.toLocaleString()}`} has been processed.\n\nFund: ${request.fund_name}\nAmount Paid: $${amountPaid.toLocaleString()}\nPayment Method: ${disbursementData.payment_method}\nDate: ${format(new Date(disbursementData.paid_at), "MMMM d, yyyy")}\n\n${isPaidInFull ? "Your request is now complete." : `Remaining balance: $${(totalDisbursed + amountPaid - request.requested_amount).toLocaleString()}`}\n\nBest regards,\nStudent Funds Team`
    });

    queryClient.invalidateQueries(["fundRequest", requestId]);
    queryClient.invalidateQueries(["disbursements", requestId]);
    queryClient.invalidateQueries(["allDisbursements"]);
    setShowDisbursementModal(false);
    setDisbursementData({
      amount_paid: "",
      paid_at: "",
      payment_method: "",
      notes: "",
      receipt_upload: ""
    });
    setSubmitting(false);
  };

  if (isLoading || !user) {
    return (
      <div className="flex items-center justify-center min-h-[60vh]">
        <LoadingSpinner size="lg" />
      </div>
    );
  }

  if (!request) {
    return (
      <div className="text-center py-16">
        <p className="text-slate-500">Request not found</p>
        <Button asChild className="mt-4">
          <Link to={createPageUrl("Queue")}>Back to Queue</Link>
        </Button>
      </div>
    );
  }

  // Check if current user can review this request
  const currentReview = reviews.find(r => 
    (r.reviewer_user_id === user.id || r.reviewer_user_id === `role_${user.app_role}`) &&
    r.decision === "Pending" &&
    r.step_order === request.current_step_order
  );

  const canReview = currentReview && ["Submitted", "In Review", "Needs Info"].includes(request.status);
  
  // Check if this is the final step
  const maxStepOrder = Math.max(...reviews.map(r => r.step_order || 0), 0);
  const isFinalStep = currentReview?.step_order === maxStepOrder;
  
  const canDisburse = request.status === "Approved" && ["fund_manager", "admin"].includes(user.app_role);

  // Check if user can see PII (only fund managers and admins)
  const canSeePII = ["fund_manager", "admin"].includes(user.app_role);

  // Get internal comments (reviews with comments)
  const internalComments = reviews.filter(r => r.comments && r.comments.trim());

  // Calculate total disbursed and remaining
  const totalDisbursed = disbursements.reduce((sum, d) => sum + (d.amount_paid || 0), 0);
  const remainingToDisburse = (request.requested_amount || 0) - totalDisbursed;

  return (
    <div className="max-w-5xl mx-auto space-y-6">
      <div className="flex items-center gap-4">
        <Button variant="ghost" size="sm" asChild>
          <Link to={createPageUrl("Queue")}>
            <ArrowLeft className="w-4 h-4 mr-2" />
            Back to Queue
          </Link>
        </Button>
      </div>

      {/* Header Card */}
      <Card className="bg-white/70 backdrop-blur-sm border-slate-200/50 overflow-hidden">
        <div className="p-6 bg-gradient-to-r from-indigo-600 to-violet-600 text-white">
          <div className="flex flex-col md:flex-row md:items-center justify-between gap-4">
            <div>
              {canSeePII && (
                <div className="flex items-center gap-2 text-indigo-100 text-sm mb-1">
                  <User className="w-4 h-4" />
                  {request.student_full_name}
                </div>
              )}
              <h1 className="text-2xl font-bold">{request.fund_name}</h1>
              <p className="text-indigo-100 mt-1">{request.intended_use_category}</p>
            </div>
            <div className="flex items-center gap-4">
              <div className="text-right">
                <p className="text-indigo-100 text-sm">Requested Amount</p>
                <p className="text-3xl font-bold">${request.requested_amount?.toLocaleString()}</p>
              </div>
              <StatusBadge status={request.status} className="bg-white/20 border-white/30 text-white" />
            </div>
          </div>
        </div>
      </Card>

      <div className="grid lg:grid-cols-3 gap-6">
        {/* Main Content */}
        <div className="lg:col-span-2 space-y-6">
          {/* Student Info */}
          {canSeePII && (
            <Card className="bg-white/70 backdrop-blur-sm border-slate-200/50">
              <CardHeader>
                <CardTitle className="text-lg">Student Information</CardTitle>
              </CardHeader>
              <CardContent>
                <div className="grid md:grid-cols-3 gap-4">
                  <div>
                    <p className="text-sm text-slate-500">Full Name</p>
                    <p className="font-medium">{request.student_full_name}</p>
                  </div>
                  <div>
                    <p className="text-sm text-slate-500">Email</p>
                    <p className="font-medium">{request.student_email}</p>
                  </div>
                  <div>
                    <p className="text-sm text-slate-500">Phone</p>
                    <p className="font-medium">{request.student_phone || "Not provided"}</p>
                  </div>
                </div>
              </CardContent>
            </Card>
          )}

          {/* Request Details */}
          <Card className="bg-white/70 backdrop-blur-sm border-slate-200/50">
            <CardHeader>
              <CardTitle className="text-lg">Request Details</CardTitle>
            </CardHeader>
            <CardContent className="space-y-6">
              <div>
                <p className="text-sm text-slate-500 mb-2">Intended Use Description</p>
                <p className="text-slate-700 whitespace-pre-wrap bg-slate-50 p-4 rounded-lg">{request.intended_use_description}</p>
              </div>
              <div>
                <p className="text-sm text-slate-500 mb-2">Justification</p>
                <p className="text-slate-700 whitespace-pre-wrap bg-slate-50 p-4 rounded-lg">{request.justification_paragraph}</p>
              </div>
              {request.attachments && request.attachments.length > 0 && (
                <div>
                  <p className="text-sm text-slate-500 mb-2">Attachments ({request.attachments.length})</p>
                  <AttachmentList attachments={request.attachments} />
                </div>
              )}
            </CardContent>
          </Card>

          {/* Review Workflow */}
          <Card className="bg-white/70 backdrop-blur-sm border-slate-200/50">
            <CardHeader>
              <CardTitle className="text-lg">Review Workflow</CardTitle>
            </CardHeader>
            <CardContent>
              {reviews.length === 0 ? (
                <p className="text-slate-500 text-center py-4">No workflow configured</p>
              ) : (
                <div className="space-y-4">
                  {reviews.map((review, index) => {
                    const decisionColors = {
                      Approved: "text-emerald-600 bg-emerald-50 border-emerald-200",
                      Recommended: "text-indigo-600 bg-indigo-50 border-indigo-200",
                      Denied: "text-red-600 bg-red-50 border-red-200",
                      "Needs Info": "text-amber-600 bg-amber-50 border-amber-200",
                      Pending: "text-slate-600 bg-slate-50 border-slate-200"
                    };
                    const DecisionIcon = review.decision === "Approved" || review.decision === "Recommended" ? CheckCircle
                                       : review.decision === "Denied" ? XCircle
                                       : review.decision === "Needs Info" ? AlertCircle
                                       : Clock;
                    
                    const isCurrentStep = review.step_order === request.current_step_order;
                    
                    return (
                      <div key={review.id}>
                        <div className={`p-4 rounded-xl border ${decisionColors[review.decision]} ${isCurrentStep ? "ring-2 ring-offset-2 ring-indigo-400" : ""}`}>
                          <div className="flex items-start gap-3">
                            <div className="w-10 h-10 rounded-full flex items-center justify-center bg-white flex-shrink-0">
                              <DecisionIcon className="w-5 h-5" />
                            </div>
                            <div className="flex-1 min-w-0">
                              <div className="flex items-center gap-2 mb-1 flex-wrap">
                                <span className="font-semibold">Step {review.step_order}: {review.step_name}</span>
                                {review.permissions === "recommend_only" && (
                                  <Badge variant="outline" className="text-xs">Recommend Only</Badge>
                                )}
                                {isCurrentStep && review.decision === "Pending" && (
                                  <Badge className="bg-indigo-600 text-white text-xs">Active</Badge>
                                )}
                              </div>
                              <p className="text-sm opacity-60 mb-1">
                                {review.reviewer_name}
                                {review.decided_at && ` • ${format(new Date(review.decided_at), "MMM d, yyyy 'at' h:mm a")}`}
                              </p>
                              <p className="text-sm font-medium mb-2">
                                Decision: {review.decision}
                              </p>
                              {review.comments && (
                                <div className="bg-white/50 p-3 rounded-lg">
                                  <p className="text-sm font-medium mb-1">Comments:</p>
                                  <p className="text-sm">{review.comments}</p>
                                </div>
                              )}
                            </div>
                          </div>
                        </div>
                        {index < reviews.length - 1 && (
                          <div className="flex justify-center py-2">
                            <div className="w-px h-4 bg-slate-300"></div>
                          </div>
                        )}
                      </div>
                    );
                  })}
                </div>
              )}
            </CardContent>
          </Card>

          {/* Internal Comments Thread */}
          {internalComments.length > 0 && (
            <Card className="bg-white/70 backdrop-blur-sm border-slate-200/50">
              <CardHeader>
                <CardTitle className="text-lg flex items-center gap-2">
                  <MessageSquare className="w-5 h-5" />
                  Internal Discussion
                </CardTitle>
              </CardHeader>
              <CardContent>
                <div className="space-y-3">
                  {internalComments.map((comment) => (
                    <div key={comment.id} className="p-3 bg-slate-50 rounded-lg">
                      <div className="flex items-center gap-2 mb-1">
                        <span className="font-medium text-sm">{comment.reviewer_name}</span>
                        <span className="text-xs text-slate-500">
                          {format(new Date(comment.decided_at || comment.created_date), "MMM d 'at' h:mm a")}
                        </span>
                      </div>
                      <p className="text-sm text-slate-700">{comment.comments}</p>
                    </div>
                  ))}
                </div>
              </CardContent>
            </Card>
          )}
        </div>

        {/* Sidebar */}
        <div className="space-y-6">
          {/* Review Action */}
          {canReview && currentReview && (
            <Card className="bg-indigo-50 border-indigo-200">
              <CardHeader>
                <CardTitle className="text-lg text-indigo-800">
                  {currentReview.permissions === "recommend_only" ? "Submit Recommendation" : "Submit Review"}
                </CardTitle>
                <p className="text-sm text-indigo-600 mt-1">
                  Step {currentReview.step_order}: {currentReview.step_name}
                  {isFinalStep && " (Final Decision)"}
                </p>
              </CardHeader>
              <CardContent className="space-y-4">
                <div className="space-y-2">
                  <Label>Decision *</Label>
                  <Select value={decision} onValueChange={setDecision}>
                    <SelectTrigger>
                      <SelectValue placeholder="Select decision" />
                    </SelectTrigger>
                    <SelectContent>
                      {currentReview.permissions === "approve_deny" && (
                        <>
                          <SelectItem value="Approved">
                            <span className="flex items-center gap-2">
                              <CheckCircle className="w-4 h-4 text-emerald-600" /> Approve
                            </span>
                          </SelectItem>
                          <SelectItem value="Denied">
                            <span className="flex items-center gap-2">
                              <XCircle className="w-4 h-4 text-red-600" /> Deny
                            </span>
                          </SelectItem>
                          <SelectItem value="Needs Info">
                            <span className="flex items-center gap-2">
                              <AlertCircle className="w-4 h-4 text-amber-600" /> Request More Info
                            </span>
                          </SelectItem>
                        </>
                      )}
                      {currentReview.permissions === "recommend_only" && (
                        <SelectItem value="Approved">
                          <span className="flex items-center gap-2">
                            <CheckCircle className="w-4 h-4 text-indigo-600" /> Recommend
                          </span>
                        </SelectItem>
                      )}
                    </SelectContent>
                  </Select>
                </div>
                <div className="space-y-2">
                  <Label>
                    {decision === "Needs Info" ? "Message to Student *" : 
                     decision === "Denied" ? "Comments (Required) *" : 
                     "Comments (Internal)"}
                  </Label>
                  <Textarea
                    placeholder={
                      decision === "Needs Info" 
                        ? "Explain what additional information is needed..." 
                        : decision === "Denied"
                        ? "Provide reason for denial..."
                        : "Add your review comments..."
                    }
                    rows={4}
                    value={reviewComments}
                    onChange={(e) => setReviewComments(e.target.value)}
                  />
                  {decision === "Needs Info" && (
                    <p className="text-xs text-amber-700">
                      This message will be visible to the student and will unlock their application for editing.
                    </p>
                  )}
                  {decision === "Denied" && (
                    <p className="text-xs text-red-700">
                      A reason is required when denying a request.
                    </p>
                  )}
                </div>
                <Button
                  onClick={submitReview}
                  disabled={!decision || submitting}
                  className={`w-full ${
                    decision === "Approved" ? "bg-emerald-600 hover:bg-emerald-700" :
                    decision === "Denied" ? "bg-red-600 hover:bg-red-700" :
                    decision === "Needs Info" ? "bg-amber-600 hover:bg-amber-700" :
                    "bg-indigo-600 hover:bg-indigo-700"
                  }`}
                >
                  {submitting ? <LoadingSpinner size="sm" className="mr-2" /> : <Send className="w-4 h-4 mr-2" />}
                  {currentReview.permissions === "recommend_only" ? "Submit Recommendation" : "Submit Decision"}
                </Button>
              </CardContent>
            </Card>
          )}

          {/* Disbursement Action */}
          {canDisburse && (
            <Card className="bg-emerald-50 border-emerald-200">
              <CardHeader>
                <CardTitle className="text-lg text-emerald-800 flex items-center gap-2">
                  <CreditCard className="w-5 h-5" />
                  Ready for Disbursement
                </CardTitle>
              </CardHeader>
              <CardContent className="space-y-3">
                <div className="space-y-1">
                  <div className="flex justify-between text-sm">
                    <span className="text-emerald-700">Approved Amount:</span>
                    <span className="font-semibold text-emerald-800">
                      ${request.requested_amount?.toLocaleString()}
                    </span>
                  </div>
                  {totalDisbursed > 0 && (
                    <>
                      <div className="flex justify-between text-sm">
                        <span className="text-emerald-700">Already Disbursed:</span>
                        <span className="font-semibold text-emerald-800">
                          ${totalDisbursed.toLocaleString()}
                        </span>
                      </div>
                      <div className="flex justify-between text-sm pt-2 border-t border-emerald-200">
                        <span className="text-emerald-700">Remaining:</span>
                        <span className="font-bold text-emerald-900">
                          ${remainingToDisburse.toLocaleString()}
                        </span>
                      </div>
                    </>
                  )}
                </div>
                <Button
                  onClick={() => {
                    setDisbursementData({ 
                      ...disbursementData, 
                      amount_paid: remainingToDisburse.toString(),
                      paid_at: format(new Date(), "yyyy-MM-dd")
                    });
                    setShowDisbursementModal(true);
                  }}
                  className="w-full bg-emerald-600 hover:bg-emerald-700"
                  disabled={remainingToDisburse <= 0}
                >
                  <CreditCard className="w-4 h-4 mr-2" />
                  {remainingToDisburse > 0 ? "Process Payment" : "Fully Disbursed"}
                </Button>
              </CardContent>
            </Card>
          )}

          {/* Fund Info */}
          {fund && (
            <Card className="bg-white/70 backdrop-blur-sm border-slate-200/50">
              <CardHeader>
                <CardTitle className="text-lg">Fund Details</CardTitle>
              </CardHeader>
              <CardContent className="space-y-3">
                <div>
                  <p className="text-sm text-slate-500">Fund Name</p>
                  <p className="font-medium">{fund.fund_name}</p>
                </div>
                <div className="flex justify-between">
                  <span className="text-slate-500">Total Budget</span>
                  <span className="font-semibold">${fund.total_budget?.toLocaleString()}</span>
                </div>
                <div className="flex justify-between">
                  <span className="text-slate-500">Remaining</span>
                  <span className="font-semibold text-emerald-600">
                    ${(fund.remaining_budget || fund.total_budget)?.toLocaleString()}
                  </span>
                </div>
                <div className="pt-2">
                  <div className="h-2 bg-slate-100 rounded-full overflow-hidden">
                    <div
                      className="h-full bg-gradient-to-r from-indigo-500 to-violet-500 rounded-full"
                      style={{
                        width: `${Math.min(100, ((fund.remaining_budget || fund.total_budget) / fund.total_budget) * 100)}%`,
                      }}
                    />
                  </div>
                </div>
              </CardContent>
            </Card>
          )}

          {/* Disbursement Info */}
          {disbursements.length > 0 && (
            <Card className="bg-violet-50 border-violet-200">
              <CardHeader>
                <CardTitle className="text-lg text-violet-800">Payment History</CardTitle>
              </CardHeader>
              <CardContent className="space-y-4">
                {disbursements.map((d) => (
                  <div key={d.id} className="p-3 bg-white/50 rounded-lg space-y-2">
                    <div className="flex justify-between items-start">
                      <div>
                        <p className="font-bold text-violet-800 text-lg">
                          ${d.amount_paid?.toLocaleString()}
                        </p>
                        <p className="text-sm text-violet-600">{d.payment_method}</p>
                      </div>
                      <span className="text-xs text-violet-600">
                        {format(new Date(d.paid_at), "MMM d, yyyy")}
                      </span>
                    </div>
                    {d.notes && (
                      <p className="text-sm text-violet-700 border-t border-violet-200 pt-2">
                        {d.notes}
                      </p>
                    )}
                    {d.receipt_upload && (
                      <a
                        href={d.receipt_upload}
                        target="_blank"
                        rel="noopener noreferrer"
                        className="flex items-center gap-2 text-violet-600 hover:text-violet-800 text-sm"
                      >
                        <FileText className="w-4 h-4" />
                        View Receipt
                      </a>
                    )}
                  </div>
                ))}
                <div className="pt-3 border-t border-violet-300">
                  <div className="flex justify-between font-bold">
                    <span className="text-violet-700">Total Paid:</span>
                    <span className="text-violet-900">${totalDisbursed.toLocaleString()}</span>
                  </div>
                  {remainingToDisburse > 0 && (
                    <div className="flex justify-between text-sm mt-1">
                      <span className="text-violet-600">Remaining:</span>
                      <span className="text-violet-700">${remainingToDisburse.toLocaleString()}</span>
                    </div>
                  )}
                </div>
              </CardContent>
            </Card>
          )}

          {/* Submitted Info */}
          <Card className="bg-white/70 backdrop-blur-sm border-slate-200/50">
            <CardHeader>
              <CardTitle className="text-lg">Timeline</CardTitle>
            </CardHeader>
            <CardContent className="space-y-3">
              <div className="flex items-center gap-3 text-sm">
                <Calendar className="w-4 h-4 text-slate-400" />
                <div>
                  <p className="text-slate-500">Created</p>
                  <p className="font-medium">{format(new Date(request.created_date), "MMM d, yyyy 'at' h:mm a")}</p>
                </div>
              </div>
              {request.submitted_at && (
                <div className="flex items-center gap-3 text-sm">
                  <Send className="w-4 h-4 text-slate-400" />
                  <div>
                    <p className="text-slate-500">Submitted</p>
                    <p className="font-medium">{format(new Date(request.submitted_at), "MMM d, yyyy 'at' h:mm a")}</p>
                  </div>
                </div>
              )}
              <div className="flex items-center gap-3 text-sm">
                <Clock className="w-4 h-4 text-slate-400" />
                <div>
                  <p className="text-slate-500">Last Updated</p>
                  <p className="font-medium">{format(new Date(request.updated_date), "MMM d, yyyy 'at' h:mm a")}</p>
                </div>
              </div>
            </CardContent>
          </Card>
        </div>
      </div>

      {/* Disbursement Modal */}
      <Dialog open={showDisbursementModal} onOpenChange={setShowDisbursementModal}>
        <DialogContent className="sm:max-w-md">
          <DialogHeader>
            <DialogTitle>Process Disbursement</DialogTitle>
            <DialogDescription>
              Record the payment details for this approved request.
            </DialogDescription>
          </DialogHeader>
          <div className="space-y-4 py-4">
            <div className="p-3 bg-slate-50 rounded-lg text-sm space-y-1">
              <div className="flex justify-between">
                <span className="text-slate-600">Requested:</span>
                <span className="font-semibold">${request.requested_amount?.toLocaleString()}</span>
              </div>
              {totalDisbursed > 0 && (
                <>
                  <div className="flex justify-between">
                    <span className="text-slate-600">Previously Paid:</span>
                    <span className="font-semibold">${totalDisbursed.toLocaleString()}</span>
                  </div>
                  <div className="flex justify-between pt-1 border-t">
                    <span className="text-slate-600">Remaining:</span>
                    <span className="font-bold">${remainingToDisburse.toLocaleString()}</span>
                  </div>
                </>
              )}
            </div>

            <div className="space-y-2">
              <Label>Amount to Pay *</Label>
              <div className="relative">
                <DollarSign className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-slate-400" />
                <Input
                  type="number"
                  className="pl-9"
                  max={remainingToDisburse}
                  value={disbursementData.amount_paid}
                  onChange={(e) => setDisbursementData({ ...disbursementData, amount_paid: e.target.value })}
                />
              </div>
              <p className="text-xs text-slate-500">
                Can be partial. Max: ${remainingToDisburse.toLocaleString()}
              </p>
            </div>

            <div className="space-y-2">
              <Label>Payment Date *</Label>
              <Input
                type="date"
                value={disbursementData.paid_at}
                onChange={(e) => setDisbursementData({ ...disbursementData, paid_at: e.target.value })}
              />
            </div>

            <div className="space-y-2">
              <Label>Payment Method *</Label>
              <Select
                value={disbursementData.payment_method}
                onValueChange={(value) => setDisbursementData({ ...disbursementData, payment_method: value })}
              >
                <SelectTrigger>
                  <SelectValue placeholder="Select method" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="Direct Deposit">Direct Deposit</SelectItem>
                  <SelectItem value="Check">Check</SelectItem>
                  <SelectItem value="Wire Transfer">Wire Transfer</SelectItem>
                  <SelectItem value="Campus Credit">Campus Credit</SelectItem>
                </SelectContent>
              </Select>
            </div>

            <div className="space-y-2">
              <Label>Notes</Label>
              <Textarea
                rows={3}
                value={disbursementData.notes}
                onChange={(e) => setDisbursementData({ ...disbursementData, notes: e.target.value })}
                placeholder="Transaction reference, check number, etc..."
              />
            </div>

            <div className="space-y-2">
              <Label>Receipt (Optional)</Label>
              <div className="border-2 border-dashed border-slate-200 rounded-lg p-4 text-center">
                <input
                  type="file"
                  className="hidden"
                  id="receiptUpload"
                  onChange={handleReceiptUpload}
                  accept=".pdf,.jpg,.jpeg,.png"
                />
                <label htmlFor="receiptUpload" className="cursor-pointer">
                  <Upload className="w-6 h-6 text-slate-400 mx-auto mb-2" />
                  <p className="text-sm text-slate-600">
                    {disbursementData.receipt_upload ? "✓ Receipt uploaded" : "Click to upload receipt"}
                  </p>
                  <p className="text-xs text-slate-400 mt-1">PDF, JPG, PNG</p>
                </label>
              </div>
            </div>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setShowDisbursementModal(false)}>
              Cancel
            </Button>
            <Button
              onClick={submitDisbursement}
              disabled={
                !disbursementData.amount_paid || 
                !disbursementData.paid_at ||
                !disbursementData.payment_method || 
                parseFloat(disbursementData.amount_paid) > remainingToDisburse ||
                parseFloat(disbursementData.amount_paid) <= 0 ||
                submitting
              }
              className="bg-emerald-600 hover:bg-emerald-700"
            >
              {submitting ? <LoadingSpinner size="sm" className="mr-2" /> : <CheckCircle className="w-4 h-4 mr-2" />}
              Confirm Payment
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}