import React, { useState, useEffect } from "react";
import { useNavigate } from "react-router-dom";
import { createPageUrl } from "@/utils";
import { api } from "@/api/supabaseApi";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import PageHeader from "@/components/shared/PageHeader";
import LoadingSpinner from "@/components/shared/LoadingSpinner";
import StatusBadge from "@/components/shared/StatusBadge";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Alert, AlertDescription } from "@/components/ui/alert";
import { Textarea } from "@/components/ui/textarea";
import { Label } from "@/components/ui/label";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import {
  ArrowLeft,
  Upload,
  File,
  X,
  CheckCircle,
  XCircle,
  AlertCircle,
  User,
  DollarSign,
  Calendar,
  Paperclip
} from "lucide-react";
import { format } from "date-fns";

interface AdvisorRequest {
  id: string;
  organization_id: string;
  request_id: string;
  fund_id: string;
  fund_name: string;
  student_full_name: string;
  student_email: string;
  requested_amount: number;
  intended_use_category: string;
  intended_use_description: string;
  justification_paragraph: string;
  submitted_at?: string | null;
  status: string;
  advisor_name?: string | null;
  advisor_tasks_completed?: boolean;
  attachments?: {
    name: string;
    url: string;
    type?: string;
    uploaded_by?: string;
    uploaded_at?: string;
  }[];
}

interface CurrentUser {
  id: string;
  full_name: string;
  app_role: string;
}

export default function AdvisorRequestDetail() {
  const navigate = useNavigate();
  const queryClient = useQueryClient();
  const [user, setUser] = useState<CurrentUser | null>(null);
  const [requestId, setRequestId] = useState<string | null>(null);
  const [uploading, setUploading] = useState(false);
  const [submitting, setSubmitting] = useState(false);
  const [notes, setNotes] = useState("");
  const [showCompleteModal, setShowCompleteModal] = useState(false);
  const [showCloseModal, setShowCloseModal] = useState(false);

  useEffect(() => {
    loadUser();
    const urlParams = new URLSearchParams(window.location.search);
    const id = urlParams.get("id");
    setRequestId(id);
  }, []);

  const loadUser = async () => {
    const currentUser = await api.auth.me();
    setUser(currentUser);
  };

  const { data: request, isLoading } = useQuery<AdvisorRequest | undefined>({
    queryKey: ["fundRequest", requestId],
    queryFn: () => api.entities.FundRequest.filter({ id: requestId }),
    enabled: !!requestId,
    select: (data) => data[0] as AdvisorRequest | undefined,
  });

  const handleFileUpload = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const files = Array.from(e.target.files as FileList);
    if (!files.length) return;

    setUploading(true);
    const uploadedFiles = [];

    for (const file of files) {
      try {
        const { file_url } = await api.integrations.Core.UploadFile({ file });
        uploadedFiles.push({
          name: file.name,
          url: file_url,
          type: file.type,
          uploaded_by: "advisor",
          uploaded_at: new Date().toISOString()
        });
      } catch (error) {
        console.error("Error uploading file:", error);
      }
    }

    if (uploadedFiles.length > 0) {
      const updatedAttachments = [...(request.attachments || []), ...uploadedFiles];
      await api.entities.FundRequest.update(request.id, {
        attachments: updatedAttachments
      });

      await api.entities.AuditLog.create({
        organization_id: request.organization_id,
        actor_user_id: user.id,
        actor_name: user.full_name,
        action_type: "DOCUMENTS_UPLOADED",
        entity_type: "FundRequest",
        entity_id: request.id,
        details: JSON.stringify({
          request_id: request.request_id,
          files_count: uploadedFiles.length,
          uploaded_by: "advisor"
        })
      });

      queryClient.invalidateQueries({ queryKey: ["fundRequest", requestId] });
    }

    setUploading(false);
    e.target.value = null;
  };

  const removeAttachment = async (index: number) => {
    const updatedAttachments = (request?.attachments || []).filter((_, i) => i !== index);
    await api.entities.FundRequest.update(request.id, {
      attachments: updatedAttachments
    });
    queryClient.invalidateQueries({ queryKey: ["fundRequest", requestId] });
  };

  const handleMarkComplete = async () => {
    setSubmitting(true);

    await api.entities.FundRequest.update(request.id, {
      advisor_tasks_completed: true
    });

    if (notes.trim()) {
      await api.entities.AuditLog.create({
        organization_id: request.organization_id,
        actor_user_id: user.id,
        actor_name: user.full_name,
        action_type: "ADVISOR_TASKS_COMPLETED",
        entity_type: "FundRequest",
        entity_id: request.id,
        details: JSON.stringify({
          request_id: request.request_id,
          notes: notes
        })
      });
    }

    queryClient.invalidateQueries({ queryKey: ["fundRequest", requestId] });
    queryClient.invalidateQueries({ queryKey: ["advisorRequests"] });
    setShowCompleteModal(false);
    setSubmitting(false);
  };

  const handleCloseRequest = async () => {
    setSubmitting(true);

    await api.entities.FundRequest.update(request.id, {
      status: "Closed",
      locked: true
    });

    await api.entities.AuditLog.create({
      organization_id: request.organization_id,
      actor_user_id: user.id,
      actor_name: user.full_name,
      action_type: "REQUEST_CLOSED",
      entity_type: "FundRequest",
      entity_id: request.id,
      details: JSON.stringify({
        request_id: request.request_id,
        closed_by: "advisor",
        notes: notes
      })
    });

    setShowCloseModal(false);
    setSubmitting(false);
    navigate(createPageUrl("AdvisorQueue"));
  };

  if (isLoading || !user || !request) {
    return (
      <div className="flex items-center justify-center min-h-[60vh]">
        <LoadingSpinner size="lg" />
      </div>
    );
  }

  return (
    <div className="space-y-6">
      <div className="flex items-center gap-4">
        <Button
          variant="ghost"
          onClick={() => navigate(createPageUrl("AdvisorQueue"))}
        >
          <ArrowLeft className="w-4 h-4 mr-2" />
          Back to Queue
        </Button>
      </div>

      <PageHeader
        title={`Application: ${request.request_id}`}
        description={`Review and manage this application`}
        actions={
          <div className="flex items-center gap-2">
            {!request.advisor_tasks_completed && (
              <Button
                onClick={() => setShowCompleteModal(true)}
                className="bg-green-600 hover:bg-green-700"
              >
                <CheckCircle className="w-4 h-4 mr-2" />
                Mark Complete
              </Button>
            )}
            {request.status !== "Closed" && (
              <Button
                variant="destructive"
                onClick={() => setShowCloseModal(true)}
              >
                <XCircle className="w-4 h-4 mr-2" />
                Close Request
              </Button>
            )}
          </div>
        }
      />

      {/* Status Banner */}
      {request.advisor_tasks_completed && (
        <Alert className="bg-green-50 border-green-200">
          <CheckCircle className="w-4 h-4 text-green-600" />
          <AlertDescription className="text-green-800">
            Advisor tasks have been marked as complete for this application.
          </AlertDescription>
        </Alert>
      )}

      <div className="grid lg:grid-cols-3 gap-6">
        {/* Main Content */}
        <div className="lg:col-span-2 space-y-6">
          {/* Request Overview */}
          <Card className="bg-white/70 backdrop-blur-xs dark:bg-slate-900/70">
            <CardHeader>
              <CardTitle className="flex items-center justify-between">
                Request Details
                <StatusBadge status={request.status} />
              </CardTitle>
            </CardHeader>
            <CardContent className="space-y-4">
              <div className="grid md:grid-cols-2 gap-4">
                <div>
                  <p className="text-sm text-slate-500 dark:text-slate-400">Student Name</p>
                  <p className="font-medium">{request.student_full_name}</p>
                </div>
                <div>
                  <p className="text-sm text-slate-500 dark:text-slate-400">Email</p>
                  <p className="font-medium">{request.student_email}</p>
                </div>
                <div>
                  <p className="text-sm text-slate-500 dark:text-slate-400">Fund Name</p>
                  <p className="font-medium">{request.fund_name}</p>
                </div>
                <div>
                  <p className="text-sm text-slate-500 dark:text-slate-400">Requested Amount</p>
                  <p className="font-semibold text-lg text-indigo-600">
                    ${request.requested_amount?.toLocaleString()}
                  </p>
                </div>
                <div>
                  <p className="text-sm text-slate-500 dark:text-slate-400">Category</p>
                  <p className="font-medium">{request.intended_use_category}</p>
                </div>
                <div>
                  <p className="text-sm text-slate-500 dark:text-slate-400">Submitted</p>
                  <p className="font-medium">
                    {request.submitted_at
                      ? format(new Date(request.submitted_at), "MMM d, yyyy")
                      : "Not submitted"}
                  </p>
                </div>
              </div>

              <div className="pt-4 border-t">
                <p className="text-sm text-slate-500 mb-2 dark:text-slate-400">Intended Use</p>
                <p className="text-slate-700 dark:text-slate-200">{request.intended_use_description}</p>
              </div>

              <div className="pt-4 border-t">
                <p className="text-sm text-slate-500 mb-2 dark:text-slate-400">Justification</p>
                <p className="text-slate-700 dark:text-slate-200">{request.justification_paragraph}</p>
              </div>
            </CardContent>
          </Card>

          {/* Supporting Documents */}
          <Card className="bg-white/70 backdrop-blur-xs dark:bg-slate-900/70">
            <CardHeader>
              <CardTitle className="flex items-center gap-2">
                <Paperclip className="w-5 h-5" />
                Supporting Documents
              </CardTitle>
            </CardHeader>
            <CardContent className="space-y-4">
              <div className="border-2 border-dashed border-slate-200 rounded-xl p-6 text-center hover:border-indigo-300 transition-colors dark:border-slate-800">
                <input
                  type="file"
                  multiple
                  accept=".pdf,.jpg,.jpeg,.png,.doc,.docx"
                  className="hidden"
                  id="fileUpload"
                  onChange={handleFileUpload}
                  disabled={uploading || request.status === "Closed"}
                />
                <label htmlFor="fileUpload" className="cursor-pointer">
                  {uploading ? (
                    <LoadingSpinner size="sm" className="mx-auto mb-2" />
                  ) : (
                    <Upload className="w-8 h-8 text-slate-400 mx-auto mb-2 dark:text-slate-500" />
                  )}
                  <p className="text-sm text-slate-600 dark:text-slate-300">
                    {uploading ? "Uploading..." : "Click to upload additional documents"}
                  </p>
                  <p className="text-xs text-slate-400 mt-1 dark:text-slate-500">
                    PDF, JPG, PNG, DOC • Max 10MB per file
                  </p>
                </label>
              </div>

              {request.attachments && request.attachments.length > 0 && (
                <div className="space-y-2">
                  {request.attachments.map((file, index) => (
                    <div
                      key={index}
                      className="flex items-center justify-between p-3 bg-slate-50 rounded-lg dark:bg-slate-900"
                    >
                      <div className="flex items-center gap-3 flex-1 min-w-0">
                        <File className="w-4 h-4 text-indigo-600 shrink-0" />
                        <div className="flex-1 min-w-0">
                          <p className="text-sm text-slate-700 truncate dark:text-slate-200">{file.name}</p>
                          {(file.uploaded_by === "advisor" || file.uploaded_by === "advocate") && (
                            <p className="text-xs text-green-600">Uploaded by advisor</p>
                          )}
                        </div>
                      </div>
                      <div className="flex items-center gap-2">
                        <a
                          href={file.url}
                          target="_blank"
                          rel="noopener noreferrer"
                          className="text-indigo-600 hover:text-indigo-700 text-sm"
                        >
                          View
                        </a>
                        {(file.uploaded_by === "advisor" || file.uploaded_by === "advocate") && request.status !== "Closed" && (
                          <Button
                            variant="ghost"
                            size="sm"
                            onClick={() => removeAttachment(index)}
                            className="text-red-600 hover:text-red-700 hover:bg-red-50"
                          >
                            <X className="w-4 h-4" />
                          </Button>
                        )}
                      </div>
                    </div>
                  ))}
                </div>
              )}
            </CardContent>
          </Card>
        </div>

        {/* Sidebar */}
        <div className="space-y-6">
          {/* Quick Info */}
          <Card className="bg-linear-to-br from-indigo-50 to-violet-50 border-indigo-200">
            <CardHeader>
              <CardTitle className="text-lg">Quick Info</CardTitle>
            </CardHeader>
            <CardContent className="space-y-3 text-sm">
              <div className="flex items-start gap-3">
                <User className="w-4 h-4 text-indigo-600 mt-0.5" />
                <div>
                  <p className="text-slate-600 dark:text-slate-300">Advisor</p>
                  <p className="font-medium text-slate-800 dark:text-slate-100">{request.advisor_name || "Unassigned"}</p>
                </div>
              </div>
              <div className="flex items-start gap-3">
                <DollarSign className="w-4 h-4 text-indigo-600 mt-0.5" />
                <div>
                  <p className="text-slate-600 dark:text-slate-300">Amount</p>
                  <p className="font-medium text-slate-800 dark:text-slate-100">
                    ${request.requested_amount?.toLocaleString()}
                  </p>
                </div>
              </div>
              <div className="flex items-start gap-3">
                <Calendar className="w-4 h-4 text-indigo-600 mt-0.5" />
                <div>
                  <p className="text-slate-600 dark:text-slate-300">Submitted</p>
                  <p className="font-medium text-slate-800 dark:text-slate-100">
                    {request.submitted_at
                      ? format(new Date(request.submitted_at), "MMM d, yyyy")
                      : "Not submitted"}
                  </p>
                </div>
              </div>
            </CardContent>
          </Card>
        </div>
      </div>

      {/* Complete Tasks Modal */}
      <Dialog open={showCompleteModal} onOpenChange={setShowCompleteModal}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2">
              <CheckCircle className="w-5 h-5 text-green-500" />
              Mark Tasks Complete
            </DialogTitle>
            <DialogDescription>
              Mark your advisor tasks as complete for this application.
            </DialogDescription>
          </DialogHeader>
          <div className="space-y-4 py-4">
            <div className="space-y-2">
              <Label>Notes (Optional)</Label>
              <Textarea
                placeholder="Add any notes about your work on this application..."
                rows={4}
                value={notes}
                onChange={(e) => setNotes(e.target.value)}
              />
            </div>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setShowCompleteModal(false)}>
              Cancel
            </Button>
            <Button
              onClick={handleMarkComplete}
              disabled={submitting}
              className="bg-green-600 hover:bg-green-700"
            >
              {submitting ? <LoadingSpinner size="sm" className="mr-2" /> : null}
              Mark Complete
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Close Request Modal */}
      <Dialog open={showCloseModal} onOpenChange={setShowCloseModal}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2">
              <AlertCircle className="w-5 h-5 text-red-500" />
              Close Request
            </DialogTitle>
            <DialogDescription>
              This will close the request and lock it from further editing. This action cannot be undone.
            </DialogDescription>
          </DialogHeader>
          <div className="space-y-4 py-4">
            <Alert className="bg-amber-50 border-amber-200">
              <AlertCircle className="w-4 h-4 text-amber-600" />
              <AlertDescription className="text-amber-900 text-sm">
                Closing this request will prevent any further changes or reviews.
              </AlertDescription>
            </Alert>
            <div className="space-y-2">
              <Label>Reason for Closing (Optional)</Label>
              <Textarea
                placeholder="Explain why this request is being closed..."
                rows={4}
                value={notes}
                onChange={(e) => setNotes(e.target.value)}
              />
            </div>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setShowCloseModal(false)}>
              Cancel
            </Button>
            <Button
              variant="destructive"
              onClick={handleCloseRequest}
              disabled={submitting}
            >
              {submitting ? <LoadingSpinner size="sm" className="mr-2" /> : null}
              Close Request
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}