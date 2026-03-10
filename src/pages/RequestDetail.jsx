import React, { useState, useEffect } from "react";
import { Link, useNavigate } from "react-router-dom";
import { createPageUrl } from "@/utils";
import { base44 } from "@/api/base44Client";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import StatusTimeline from "@/components/requests/StatusTimeline";
import StatusBadge from "@/components/shared/StatusBadge";
import LoadingSpinner from "@/components/shared/LoadingSpinner";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Textarea } from "@/components/ui/textarea";
import { Label } from "@/components/ui/label";
import { Alert, AlertDescription } from "@/components/ui/alert";
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
  Lock,
  AlertCircle,
  Hash,
  Mail,
  Phone,
  Tag,
  Paperclip
} from "lucide-react";
import { format } from "date-fns";

export default function RequestDetail() {
  const navigate = useNavigate();
  const queryClient = useQueryClient();
  const [user, setUser] = useState(null);
  const [response, setResponse] = useState("");
  const [submitting, setSubmitting] = useState(false);

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
    queryFn: () => base44.entities.Review.filter({ fund_request_id: requestId }, "-created_date"),
    enabled: !!requestId,
  });

  const { data: disbursements = [] } = useQuery({
    queryKey: ["disbursements", requestId],
    queryFn: () => base44.entities.Disbursement.filter({ fund_request_id: requestId }),
    enabled: !!requestId,
  });

  const submitResponse = async () => {
    if (!response.trim()) return;
    
    setSubmitting(true);

    // Add student response as a review
    await base44.entities.Review.create({
      fund_request_id: requestId,
      reviewer_user_id: user.id,
      reviewer_name: user.full_name,
      step_name: "Student Response",
      decision: "Pending",
      comments: response,
      decided_at: new Date().toISOString()
    });

    // Update request status back to In Review
    await base44.entities.FundRequest.update(requestId, {
      status: "In Review"
    });

    // Create audit log
    await base44.entities.AuditLog.create({
      actor_user_id: user.id,
      actor_name: user.full_name,
      action_type: "STUDENT_RESPONSE",
      entity_type: "FundRequest",
      entity_id: requestId,
      details: JSON.stringify({ response })
    });

    queryClient.invalidateQueries(["fundRequest", requestId]);
    queryClient.invalidateQueries(["reviews", requestId]);
    setResponse("");
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
        <FileText className="w-16 h-16 mx-auto text-slate-300 mb-4" />
        <p className="text-slate-500 mb-4">Request not found</p>
        <Button asChild>
          <Link to={createPageUrl("MyRequests")}>
            <ArrowLeft className="w-4 h-4 mr-2" />
            Back to My Requests
          </Link>
        </Button>
      </div>
    );
  }

  const canRespond = request.status === "Needs Info" && request.student_user_id === user.id;
  const isLocked = request.locked && request.status !== "Needs Info";

  return (
    <div className="max-w-5xl mx-auto space-y-6">
      {/* Back Button */}
      <div className="flex items-center gap-4">
        <Button variant="ghost" size="sm" asChild>
          <Link to={createPageUrl("MyRequests")}>
            <ArrowLeft className="w-4 h-4 mr-2" />
            Back to My Requests
          </Link>
        </Button>
      </div>

      {/* Header Card */}
      <Card className="bg-white/70 backdrop-blur-sm border-slate-200/50 overflow-hidden">
        <div className="p-6 bg-gradient-to-r from-indigo-600 to-violet-600 text-white">
          <div className="flex flex-col md:flex-row md:items-start justify-between gap-4">
            <div className="flex-1">
              <div className="flex items-center gap-2 mb-2">
                <Hash className="w-4 h-4" />
                <span className="font-mono text-sm bg-white/20 px-3 py-1 rounded-lg">
                  {request.request_id}
                </span>
                {isLocked && (
                  <div className="flex items-center gap-1 bg-white/20 px-2 py-1 rounded-lg">
                    <Lock className="w-3 h-3" />
                    <span className="text-xs">Locked</span>
                  </div>
                )}
              </div>
              <h1 className="text-2xl font-bold mb-1">{request.fund_name}</h1>
              <div className="flex items-center gap-3 text-indigo-100">
                <Tag className="w-4 h-4" />
                <span>{request.intended_use_category}</span>
              </div>
            </div>
            <div className="flex flex-col items-end gap-2">
              <div className="text-right">
                <p className="text-indigo-100 text-sm">Requested Amount</p>
                <p className="text-3xl font-bold">${request.requested_amount?.toLocaleString()}</p>
              </div>
              <StatusBadge status={request.status} className="bg-white/20 border-white/30 text-white" />
            </div>
          </div>
        </div>
      </Card>

      {/* Status Timeline */}
      <Card className="bg-white/70 backdrop-blur-sm border-slate-200/50">
        <CardHeader>
          <CardTitle className="text-lg">Application Progress</CardTitle>
        </CardHeader>
        <CardContent className="pt-6 pb-8">
          <StatusTimeline 
            request={request} 
            reviews={reviews} 
            disbursements={disbursements} 
          />
        </CardContent>
      </Card>

      {/* Needs Info Alert */}
      {canRespond && (
        <Alert className="bg-amber-50 border-amber-200">
          <AlertCircle className="w-4 h-4 text-amber-600" />
          <AlertDescription className="text-amber-900">
            <strong>Additional Information Requested:</strong> Please review the comments below and provide the requested information.
          </AlertDescription>
        </Alert>
      )}

      <div className="grid lg:grid-cols-3 gap-6">
        {/* Main Content */}
        <div className="lg:col-span-2 space-y-6">
          {/* Application Details */}
          <Card className="bg-white/70 backdrop-blur-sm border-slate-200/50">
            <CardHeader>
              <CardTitle className="text-lg">Application Details</CardTitle>
            </CardHeader>
            <CardContent className="space-y-6">
              {/* Contact Information */}
              <div>
                <h4 className="text-sm font-semibold text-slate-700 mb-3 flex items-center gap-2">
                  <User className="w-4 h-4" />
                  Contact Information
                </h4>
                <div className="grid md:grid-cols-3 gap-4 text-sm">
                  <div>
                    <p className="text-slate-500">Name</p>
                    <p className="font-medium">{request.student_full_name}</p>
                  </div>
                  <div>
                    <p className="text-slate-500">Email</p>
                    <p className="font-medium flex items-center gap-1">
                      <Mail className="w-3 h-3" />
                      {request.student_email}
                    </p>
                  </div>
                  <div>
                    <p className="text-slate-500">Phone</p>
                    <p className="font-medium flex items-center gap-1">
                      <Phone className="w-3 h-3" />
                      {request.student_phone || "Not provided"}
                    </p>
                  </div>
                </div>
              </div>

              {/* Request Information */}
              <div className="pt-4 border-t">
                <h4 className="text-sm font-semibold text-slate-700 mb-3 flex items-center gap-2">
                  <DollarSign className="w-4 h-4" />
                  Request Information
                </h4>
                <div className="grid md:grid-cols-2 gap-4 text-sm mb-4">
                  <div>
                    <p className="text-slate-500">Requested Amount</p>
                    <p className="text-2xl font-bold text-indigo-600">
                      ${request.requested_amount?.toLocaleString()}
                    </p>
                  </div>
                  <div>
                    <p className="text-slate-500">Category</p>
                    <p className="font-medium">{request.intended_use_category}</p>
                  </div>
                </div>
              </div>

              {/* Intended Use */}
              <div className="pt-4 border-t">
                <p className="text-sm font-semibold text-slate-700 mb-2">How will you use these funds?</p>
                <div className="bg-slate-50 p-4 rounded-lg">
                  <p className="text-slate-700 whitespace-pre-wrap">{request.intended_use_description}</p>
                </div>
              </div>

              {/* Justification */}
              <div className="pt-4 border-t">
                <p className="text-sm font-semibold text-slate-700 mb-2">Why do you deserve these funds?</p>
                <div className="bg-slate-50 p-4 rounded-lg">
                  <p className="text-slate-700 whitespace-pre-wrap">{request.justification_paragraph}</p>
                </div>
              </div>

              {/* Attachments */}
              {request.attachments && request.attachments.length > 0 && (
                <div className="pt-4 border-t">
                  <p className="text-sm font-semibold text-slate-700 mb-3 flex items-center gap-2">
                    <Paperclip className="w-4 h-4" />
                    Supporting Documents ({request.attachments.length})
                  </p>
                  <AttachmentList attachments={request.attachments} />
                </div>
              )}
            </CardContent>
          </Card>

          {/* Activity / Reviews */}
          <Card className="bg-white/70 backdrop-blur-sm border-slate-200/50">
            <CardHeader>
              <CardTitle className="text-lg flex items-center gap-2">
                <MessageSquare className="w-5 h-5" />
                Activity & Reviews
              </CardTitle>
            </CardHeader>
            <CardContent>
              {reviews.length === 0 ? (
                <div className="text-center py-8">
                  <MessageSquare className="w-12 h-12 text-slate-300 mx-auto mb-2" />
                  <p className="text-slate-500">No activity yet</p>
                  <p className="text-sm text-slate-400">Reviews and comments will appear here</p>
                </div>
              ) : (
                <div className="space-y-4">
                  {reviews.map((review) => {
                    const decisionColors = {
                      Approved: "bg-emerald-50 border-emerald-200",
                      Denied: "bg-red-50 border-red-200",
                      "Needs Info": "bg-amber-50 border-amber-200",
                      Pending: "bg-blue-50 border-blue-200"
                    };

                    const isStudentResponse = review.step_name === "Student Response";

                    return (
                      <div 
                        key={review.id} 
                        className={`p-4 rounded-xl border ${decisionColors[review.decision] || "bg-slate-50 border-slate-200"}`}
                      >
                        <div className="flex items-start gap-3">
                          <div className="w-10 h-10 rounded-full bg-white border-2 border-current flex items-center justify-center flex-shrink-0">
                            {isStudentResponse ? (
                              <User className="w-5 h-5" />
                            ) : (
                              <MessageSquare className="w-5 h-5" />
                            )}
                          </div>
                          <div className="flex-1 min-w-0">
                            <div className="flex items-center gap-2 mb-1 flex-wrap">
                              <span className="font-semibold text-slate-800">
                                {review.reviewer_name}
                              </span>
                              <span className="text-xs text-slate-500">
                                {review.step_name}
                              </span>
                              {review.decision !== "Pending" && (
                                <span className={`text-xs font-medium px-2 py-0.5 rounded ${
                                  review.decision === "Approved" ? "bg-emerald-200 text-emerald-800" :
                                  review.decision === "Denied" ? "bg-red-200 text-red-800" :
                                  review.decision === "Needs Info" ? "bg-amber-200 text-amber-800" :
                                  "bg-blue-200 text-blue-800"
                                }`}>
                                  {review.decision}
                                </span>
                              )}
                            </div>
                            <p className="text-xs text-slate-500 mb-2">
                              {format(new Date(review.created_date), "MMMM d, yyyy 'at' h:mm a")}
                            </p>
                            {review.comments && (
                              <div className="bg-white/70 p-3 rounded-lg mt-2">
                                <p className="text-slate-700 whitespace-pre-wrap">{review.comments}</p>
                              </div>
                            )}
                          </div>
                        </div>
                      </div>
                    );
                  })}
                </div>
              )}
            </CardContent>
          </Card>

          {/* Response Form (if Needs Info) */}
          {canRespond && (
            <Card className="bg-amber-50/50 border-amber-200">
              <CardHeader>
                <CardTitle className="text-lg text-amber-800 flex items-center gap-2">
                  <AlertCircle className="w-5 h-5" />
                  Provide Additional Information
                </CardTitle>
              </CardHeader>
              <CardContent className="space-y-4">
                <div>
                  <Label htmlFor="response" className="text-amber-900">Your Response</Label>
                  <Textarea
                    id="response"
                    placeholder="Provide the additional information requested by the reviewer..."
                    rows={5}
                    value={response}
                    onChange={(e) => setResponse(e.target.value)}
                    className="mt-2 bg-white"
                  />
                </div>
                <Button
                  onClick={submitResponse}
                  disabled={!response.trim() || submitting}
                  className="bg-amber-600 hover:bg-amber-700 w-full sm:w-auto"
                >
                  {submitting ? (
                    <LoadingSpinner size="sm" className="mr-2" />
                  ) : (
                    <Send className="w-4 h-4 mr-2" />
                  )}
                  Submit Response
                </Button>
              </CardContent>
            </Card>
          )}
        </div>

        {/* Sidebar */}
        <div className="space-y-6">
          {/* Timeline Info */}
          <Card className="bg-white/70 backdrop-blur-sm border-slate-200/50">
            <CardHeader>
              <CardTitle className="text-lg">Timeline</CardTitle>
            </CardHeader>
            <CardContent className="space-y-3 text-sm">
              <div className="flex items-start gap-3">
                <Calendar className="w-4 h-4 text-slate-400 mt-0.5" />
                <div>
                  <p className="text-slate-500">Created</p>
                  <p className="font-medium">
                    {format(new Date(request.created_date), "MMM d, yyyy 'at' h:mm a")}
                  </p>
                </div>
              </div>
              
              {request.submitted_at && (
                <div className="flex items-start gap-3">
                  <Send className="w-4 h-4 text-slate-400 mt-0.5" />
                  <div>
                    <p className="text-slate-500">Submitted</p>
                    <p className="font-medium">
                      {format(new Date(request.submitted_at), "MMM d, yyyy 'at' h:mm a")}
                    </p>
                  </div>
                </div>
              )}
              
              <div className="flex items-start gap-3">
                <FileText className="w-4 h-4 text-slate-400 mt-0.5" />
                <div>
                  <p className="text-slate-500">Last Updated</p>
                  <p className="font-medium">
                    {format(new Date(request.updated_date), "MMM d, yyyy 'at' h:mm a")}
                  </p>
                </div>
              </div>
            </CardContent>
          </Card>

          {/* Disbursement Info */}
          {disbursements.length > 0 && (
            <Card className="bg-emerald-50 border-emerald-200">
              <CardHeader>
                <CardTitle className="text-lg text-emerald-800 flex items-center gap-2">
                  <DollarSign className="w-5 h-5" />
                  Payment Disbursed
                </CardTitle>
              </CardHeader>
              <CardContent>
                {disbursements.map((d) => (
                  <div key={d.id} className="space-y-3 text-sm">
                    <div className="flex justify-between items-center">
                      <span className="text-emerald-700">Amount Paid</span>
                      <span className="text-2xl font-bold text-emerald-800">
                        ${d.amount_paid?.toLocaleString()}
                      </span>
                    </div>
                    <div className="flex justify-between">
                      <span className="text-emerald-700">Payment Method</span>
                      <span className="font-medium text-emerald-800">{d.payment_method}</span>
                    </div>
                    <div className="flex justify-between">
                      <span className="text-emerald-700">Date Paid</span>
                      <span className="font-medium text-emerald-800">
                        {format(new Date(d.paid_at), "MMM d, yyyy")}
                      </span>
                    </div>
                    {d.notes && (
                      <div className="pt-2 border-t border-emerald-200">
                        <p className="text-emerald-700 text-xs">Notes:</p>
                        <p className="text-emerald-800 mt-1">{d.notes}</p>
                      </div>
                    )}
                    {d.receipt_upload && (
                      <a
                        href={d.receipt_upload}
                        target="_blank"
                        rel="noopener noreferrer"
                        className="flex items-center gap-2 text-emerald-700 hover:text-emerald-900 pt-2"
                      >
                        <FileText className="w-4 h-4" />
                        <span className="text-sm">View Receipt</span>
                        <ExternalLink className="w-3 h-3" />
                      </a>
                    )}
                  </div>
                ))}
              </CardContent>
            </Card>
          )}

          {/* Quick Stats */}
          <Card className="bg-white/70 backdrop-blur-sm border-slate-200/50">
            <CardHeader>
              <CardTitle className="text-lg">Request Summary</CardTitle>
            </CardHeader>
            <CardContent className="space-y-3 text-sm">
              <div className="flex justify-between">
                <span className="text-slate-500">Request ID</span>
                <span className="font-mono font-medium">{request.request_id}</span>
              </div>
              <div className="flex justify-between">
                <span className="text-slate-500">Fund</span>
                <span className="font-medium">{request.fund_name}</span>
              </div>
              <div className="flex justify-between">
                <span className="text-slate-500">Status</span>
                <StatusBadge status={request.status} />
              </div>
              <div className="flex justify-between items-start">
                <span className="text-slate-500">Reviews</span>
                <span className="font-medium">{reviews.filter(r => r.decision !== "Pending").length}</span>
              </div>
              {isLocked && (
                <div className="pt-3 border-t">
                  <div className="flex items-center gap-2 text-slate-500">
                    <Lock className="w-4 h-4" />
                    <span className="text-xs">
                      This request is locked and cannot be edited
                    </span>
                  </div>
                </div>
              )}
            </CardContent>
          </Card>
        </div>
      </div>
    </div>
  );
}