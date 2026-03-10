import React, { useState, useEffect } from "react";
import { useNavigate } from "react-router-dom";
import { createPageUrl } from "@/utils";
import { base44 } from "@/api/base44Client";
import { useQuery } from "@tanstack/react-query";
import PageHeader from "@/components/shared/PageHeader";
import LoadingSpinner from "@/components/shared/LoadingSpinner";
import EmptyState from "@/components/shared/EmptyState";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Label } from "@/components/ui/label";
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
import {
  Alert,
  AlertDescription,
} from "@/components/ui/alert";
import {
  Wallet,
  Upload,
  X,
  FileText,
  Calendar,
  DollarSign,
  ArrowRight,
  Send,
  Save,
  CheckCircle,
  AlertCircle,
  AlertTriangle,
  Paperclip,
  File
} from "lucide-react";
import { format } from "date-fns";

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

const ALLOWED_FILE_TYPES = [
  'application/pdf',
  'image/jpeg',
  'image/jpg',
  'image/png',
  'application/msword',
  'application/vnd.openxmlformats-officedocument.wordprocessingml.document'
];

const MAX_FILE_SIZE = 10 * 1024 * 1024; // 10MB

export default function Apply() {
  const navigate = useNavigate();
  const [user, setUser] = useState(null);
  const [selectedFund, setSelectedFund] = useState(null);
  const [formData, setFormData] = useState({
    student_full_name: "",
    student_email: "",
    student_phone: "",
    requested_amount: "",
    intended_use_category: "",
    intended_use_description: "",
    justification_paragraph: "",
    attachments: []
  });
  const [uploading, setUploading] = useState(false);
  const [submitting, setSubmitting] = useState(false);
  const [showConfirmModal, setShowConfirmModal] = useState(false);
  const [errors, setErrors] = useState({});

  useEffect(() => {
    loadUser();
    checkUrlParams();
  }, []);

  const loadUser = async () => {
    const currentUser = await base44.auth.me();
    setUser(currentUser);
    setFormData(prev => ({
      ...prev,
      student_full_name: currentUser.full_name || "",
      student_email: currentUser.email || "",
      student_phone: currentUser.phone || ""
    }));
  };

  const checkUrlParams = () => {
    const urlParams = new URLSearchParams(window.location.search);
    const fundId = urlParams.get("fund");
    if (fundId) {
      setSelectedFund({ id: fundId });
    }
  };

  const { data: funds = [], isLoading } = useQuery({
    queryKey: ["activeFunds"],
    queryFn: () => base44.entities.Fund.filter({ status: "active" }),
  });

  useEffect(() => {
    if (selectedFund?.id && funds.length > 0) {
      const fund = funds.find(f => f.id === selectedFund.id);
      if (fund) {
        setSelectedFund(fund);
      }
    }
  }, [funds, selectedFund?.id]);

  const validateField = (name, value) => {
    const newErrors = { ...errors };

    switch (name) {
      case "student_full_name":
        if (!value || value.trim().length === 0) {
          newErrors.student_full_name = "Full name is required";
        } else {
          delete newErrors.student_full_name;
        }
        break;
      case "student_email":
        if (!value || !value.includes("@")) {
          newErrors.student_email = "Valid email is required";
        } else {
          delete newErrors.student_email;
        }
        break;
      case "requested_amount":
        const amount = parseFloat(value);
        if (!value || amount <= 0) {
          newErrors.requested_amount = "Amount must be greater than 0";
        } else if (selectedFund?.max_request_amount && amount > selectedFund.max_request_amount) {
          newErrors.requested_amount = `Amount cannot exceed $${selectedFund.max_request_amount.toLocaleString()}`;
        } else {
          delete newErrors.requested_amount;
        }
        break;
      case "intended_use_category":
        if (!value) {
          newErrors.intended_use_category = "Category is required";
        } else {
          delete newErrors.intended_use_category;
        }
        break;
      case "student_phone":
        if ((selectedFund?.application_fields?.phone?.required ?? false) && !value?.trim()) {
          newErrors.student_phone = "Phone number is required";
        } else {
          delete newErrors.student_phone;
        }
        break;
      case "intended_use_description":
        if ((selectedFund?.application_fields?.intended_use_description?.required ?? true) && (!value || value.trim().length < 30)) {
          newErrors.intended_use_description = "Description must be at least 30 characters";
        } else {
          delete newErrors.intended_use_description;
        }
        break;
      case "justification_paragraph":
        if ((selectedFund?.application_fields?.justification_paragraph?.required ?? true) && (!value || value.trim().length < 100)) {
          newErrors.justification_paragraph = "Justification must be at least 100 characters";
        } else {
          delete newErrors.justification_paragraph;
        }
        break;
    }

    setErrors(newErrors);
  };

  const handleInputChange = (name, value) => {
    setFormData({ ...formData, [name]: value });
    validateField(name, value);
  };

  const handleFileUpload = async (e) => {
    const files = Array.from(e.target.files);
    if (!files.length) return;

    // Validate files
    const invalidFiles = files.filter(file => 
      !ALLOWED_FILE_TYPES.includes(file.type) || file.size > MAX_FILE_SIZE
    );

    if (invalidFiles.length > 0) {
      alert(`Some files are invalid. Please ensure all files are PDF, JPG, PNG, or DOC and under 10MB.`);
      return;
    }

    // Check if attachments required
    if (selectedFund?.requires_attachments && formData.attachments.length === 0 && files.length === 0) {
      alert("This fund requires supporting documents to be uploaded.");
    }

    setUploading(true);
    const uploadedFiles = [];

    for (const file of files) {
      const { file_url } = await base44.integrations.Core.UploadFile({ file });
      uploadedFiles.push({ 
        name: file.name, 
        url: file_url,
        type: file.type,
        uploaded_by: "student",
        uploaded_at: new Date().toISOString()
      });
    }

    setFormData(prev => ({
      ...prev,
      attachments: [...prev.attachments, ...uploadedFiles]
    }));
    setUploading(false);
    e.target.value = null;
  };

  const removeAttachment = (index) => {
    setFormData(prev => ({
      ...prev,
      attachments: prev.attachments.filter((_, i) => i !== index)
    }));
  };

  const validateForm = () => {
    const newErrors = {};
    
    // Validate student_full_name
    if (!formData.student_full_name || formData.student_full_name.trim().length === 0) {
      newErrors.student_full_name = "Full name is required";
    }
    
    // Validate student_email
    if (!formData.student_email || !formData.student_email.includes("@")) {
      newErrors.student_email = "Valid email is required";
    }
    
    // Validate requested_amount
    const amount = parseFloat(formData.requested_amount);
    if (!formData.requested_amount || amount <= 0) {
      newErrors.requested_amount = "Amount must be greater than 0";
    } else if (selectedFund?.max_request_amount && amount > selectedFund.max_request_amount) {
      newErrors.requested_amount = `Amount cannot exceed $${selectedFund.max_request_amount.toLocaleString()}`;
    }
    
    // Validate intended_use_category
    if (!formData.intended_use_category) {
      newErrors.intended_use_category = "Category is required";
    }
    
    // Validate phone if required
    if ((selectedFund.application_fields?.phone?.required ?? false) && !formData.student_phone?.trim()) {
      newErrors.student_phone = "Phone number is required";
    }
    
    // Validate intended_use_description if required
    if ((selectedFund.application_fields?.intended_use_description?.required ?? true) && 
        (!formData.intended_use_description || formData.intended_use_description.trim().length < 30)) {
      newErrors.intended_use_description = "Description must be at least 30 characters";
    }
    
    // Validate justification_paragraph if required
    if ((selectedFund.application_fields?.justification_paragraph?.required ?? true) && 
        (!formData.justification_paragraph || formData.justification_paragraph.trim().length < 100)) {
      newErrors.justification_paragraph = "Justification must be at least 100 characters";
    }

    setErrors(newErrors);
    return Object.keys(newErrors).length === 0;
  };

  const generateRequestId = async () => {
    const year = new Date().getFullYear();
    
    // Get count of requests this year to generate sequence
    const allRequests = await base44.entities.FundRequest.list();
    const thisYearRequests = allRequests.filter(r => {
      const requestYear = new Date(r.created_date).getFullYear();
      return requestYear === year;
    });
    
    const sequence = (thisYearRequests.length + 1).toString().padStart(6, '0');
    return `FUND-${year}-${sequence}`;
  };

  const handleSaveAsDraft = async () => {
    setSubmitting(true);

    const requestId = await generateRequestId();

    const requestData = {
      organization_id: selectedFund.organization_id,
      request_id: requestId,
      fund_id: selectedFund.id,
      fund_name: selectedFund.fund_name,
      fund_max_amount: selectedFund.max_request_amount || null,
      student_user_id: user.id,
      student_full_name: formData.student_full_name,
      student_email: formData.student_email,
      student_phone: formData.student_phone || "",
      requested_amount: parseFloat(formData.requested_amount) || 0,
      intended_use_category: formData.intended_use_category,
      intended_use_description: formData.intended_use_description,
      justification_paragraph: formData.justification_paragraph,
      attachments: formData.attachments,
      status: "Draft",
      locked: false
    };

    await base44.entities.FundRequest.create(requestData);

    navigate(createPageUrl("MyRequests"));
  };

  const handleSubmit = async () => {
    if (!validateForm()) {
      alert("Please fix the errors in the form before submitting.");
      return;
    }

    setShowConfirmModal(true);
  };

  const confirmSubmit = async () => {
    setSubmitting(true);

    const requestId = await generateRequestId();

    const requestData = {
      organization_id: selectedFund.organization_id,
      request_id: requestId,
      fund_id: selectedFund.id,
      fund_name: selectedFund.fund_name,
      fund_max_amount: selectedFund.max_request_amount || null,
      student_user_id: user.id,
      student_full_name: formData.student_full_name,
      student_email: formData.student_email,
      student_phone: formData.student_phone || "",
      requested_amount: parseFloat(formData.requested_amount),
      intended_use_category: formData.intended_use_category,
      intended_use_description: formData.intended_use_description,
      justification_paragraph: formData.justification_paragraph,
      attachments: formData.attachments,
      status: "Submitted",
      submitted_at: new Date().toISOString(),
      locked: true
    };

    const newRequest = await base44.entities.FundRequest.create(requestData);

    // Get routing rules for this fund
    const rules = await base44.entities.RoutingRule.filter({ 
      fund_id: selectedFund.id,
      is_active: true 
    }, "step_order");

    // Filter rules based on conditions
    const applicableRules = rules.filter(rule => {
      const amountMatch = 
        (!rule.min_amount || parseFloat(formData.requested_amount) >= rule.min_amount) &&
        (!rule.max_amount || parseFloat(formData.requested_amount) <= rule.max_amount);
      
      const categoryMatch = 
        !rule.applicable_categories || 
        rule.applicable_categories.length === 0 ||
        rule.applicable_categories.includes(formData.intended_use_category);
      
      return amountMatch && categoryMatch;
    });

    // Create review records for applicable steps
    for (const rule of applicableRules) {
      // Determine reviewers based on assignment type
      let reviewerIds = [];
      let reviewerNames = [];

      if (rule.assigned_to_type === "specific_users") {
        reviewerIds = rule.assigned_user_ids || [];
        reviewerNames = rule.assigned_user_names || [];
      } else if (rule.assigned_to_type === "role_queue") {
        // For role queue, create one review per role (to be picked up by any user with that role)
        reviewerIds = ["role_" + rule.assigned_role];
        reviewerNames = [rule.assigned_role + " Queue"];
      }

      // Create one review record per reviewer or one for the queue
      if (reviewerIds.length > 0) {
        for (let i = 0; i < reviewerIds.length; i++) {
          await base44.entities.Review.create({
            organization_id: selectedFund.organization_id,
            fund_request_id: newRequest.id,
            reviewer_user_id: reviewerIds[i],
            reviewer_name: reviewerNames[i] || "Reviewer",
            step_name: rule.step_name,
            step_order: rule.step_order,
            decision: "Pending",
            comments: "",
            permissions: rule.permissions,
            sla_target_days: rule.sla_target_days
          });
        }
      }
    }

    // Update request with current step info if there are rules
    if (applicableRules.length > 0) {
      await base44.entities.FundRequest.update(newRequest.id, {
        status: "In Review",
        current_step: applicableRules[0].step_name,
        current_step_order: applicableRules[0].step_order
      });
    }

    // Create audit log
    await base44.entities.AuditLog.create({
      organization_id: selectedFund.organization_id,
      actor_user_id: user.id,
      actor_name: user.full_name,
      action_type: "REQUEST_SUBMITTED",
      entity_type: "FundRequest",
      entity_id: newRequest.id,
      details: JSON.stringify({ 
        request_id: requestId,
        fund_name: selectedFund.fund_name, 
        amount: formData.requested_amount 
      })
    });

    setShowConfirmModal(false);
    navigate(createPageUrl(`RequestDetail?id=${newRequest.id}`));
  };

  if (!user) {
    return (
      <div className="flex items-center justify-center min-h-[60vh]">
        <LoadingSpinner size="lg" />
      </div>
    );
  }

  // If no fund selected, show fund selector
  if (!selectedFund) {
    return (
      <div className="max-w-4xl mx-auto">
        <PageHeader
          title="Apply for Fund"
          description="Select a fund to begin your application"
        />

        {isLoading ? (
          <LoadingSpinner className="py-16" />
        ) : funds.length === 0 ? (
          <EmptyState
            icon={Wallet}
            title="No Active Funds"
            description="There are no funds currently accepting applications. Please check back later."
          />
        ) : (
          <div className="grid md:grid-cols-2 gap-4">
            {funds.map((fund) => {
              const isExpiringSoon = fund.end_date && 
                new Date(fund.end_date) <= new Date(Date.now() + 7 * 24 * 60 * 60 * 1000);
              
              return (
                <Card
                  key={fund.id}
                  className="cursor-pointer transition-all hover:shadow-lg hover:border-indigo-200 bg-white/70 backdrop-blur-sm"
                  onClick={() => setSelectedFund(fund)}
                >
                  <CardHeader>
                    <div className="flex items-start justify-between">
                      <div className="flex-1">
                        <CardTitle className="text-lg mb-2">{fund.fund_name}</CardTitle>
                        <CardDescription className="text-sm">
                          {fund.description || "No description available"}
                        </CardDescription>
                      </div>
                    </div>
                  </CardHeader>
                  <CardContent>
                    <div className="space-y-3">
                      {fund.eligibility_notes && (
                        <Alert className="bg-blue-50 border-blue-200">
                          <AlertCircle className="w-4 h-4 text-blue-600" />
                          <AlertDescription className="text-blue-800 text-sm">
                            {fund.eligibility_notes}
                          </AlertDescription>
                        </Alert>
                      )}
                      
                      <div className="grid grid-cols-2 gap-4 text-sm">
                        {fund.max_request_amount && (
                          <div className="flex items-center gap-2">
                            <AlertTriangle className="w-4 h-4 text-amber-500" />
                            <div>
                              <p className="text-slate-500 text-xs">Max Request</p>
                              <p className="font-semibold text-amber-600">
                                ${fund.max_request_amount?.toLocaleString()}
                              </p>
                            </div>
                          </div>
                        )}
                        
                        {fund.end_date && (
                          <div className="flex items-center gap-2 col-span-2">
                            <Calendar className={`w-4 h-4 ${isExpiringSoon ? "text-red-500" : "text-slate-400"}`} />
                            <div>
                              <p className="text-slate-500 text-xs">Deadline</p>
                              <p className={`font-semibold text-sm ${isExpiringSoon ? "text-red-600" : ""}`}>
                                {format(new Date(fund.end_date), "MMMM d, yyyy")}
                                {isExpiringSoon && " (Expiring Soon!)"}
                              </p>
                            </div>
                          </div>
                        )}
                      </div>

                      <Button className="w-full mt-4 bg-gradient-to-r from-indigo-600 to-violet-600 hover:from-indigo-700 hover:to-violet-700">
                        Apply Now
                        <ArrowRight className="w-4 h-4 ml-2" />
                      </Button>
                    </div>
                  </CardContent>
                </Card>
              );
            })}
          </div>
        )}
      </div>
    );
  }

  // Application Form
  // Check category restrictions
  const isCategoryAllowed = !selectedFund?.allowed_categories || 
    selectedFund.allowed_categories.length === 0 ||
    selectedFund.allowed_categories.includes(formData.intended_use_category);

  const isFormValid = 
    formData.student_full_name &&
    formData.student_email &&
    formData.requested_amount &&
    parseFloat(formData.requested_amount) > 0 &&
    formData.intended_use_category &&
    isCategoryAllowed &&
    (!(selectedFund.application_fields?.phone?.required ?? false) || formData.student_phone?.trim()) &&
    (!(selectedFund.application_fields?.intended_use_description?.required ?? true) || formData.intended_use_description?.length >= 30) &&
    (!(selectedFund.application_fields?.justification_paragraph?.required ?? true) || formData.justification_paragraph?.length >= 100) &&
    (!(selectedFund.application_fields?.attachments?.required ?? false) || formData.attachments.length > 0) &&
    Object.keys(errors).length === 0;

  return (
    <div className="max-w-3xl mx-auto">
      <div className="flex items-center gap-4 mb-6">
        <Button variant="ghost" onClick={() => setSelectedFund(null)}>
          ← Back to Funds
        </Button>
      </div>

      <PageHeader
        title={`Apply: ${selectedFund.fund_name}`}
        description="Complete the application form below"
      />

      {/* Fund Info Banner */}
      {(selectedFund.max_request_amount || selectedFund.end_date) && (
        <Alert className="mb-6 bg-indigo-50 border-indigo-200">
          <Wallet className="w-4 h-4 text-indigo-600" />
          <AlertDescription className="text-indigo-900">
            <div className="flex items-center justify-between">
              {selectedFund.max_request_amount && (
                <span>
                  <strong>Max Request:</strong> ${selectedFund.max_request_amount?.toLocaleString()}
                </span>
              )}
              {selectedFund.end_date && (
                <span className="text-sm">
                  <strong>Deadline:</strong> {format(new Date(selectedFund.end_date), "MMM d, yyyy")}
                </span>
              )}
            </div>
          </AlertDescription>
        </Alert>
      )}

      <Card className="bg-white/70 backdrop-blur-sm border-slate-200/50">
        <CardHeader>
          <CardTitle>Application Form</CardTitle>
          <CardDescription>All fields marked with * are required</CardDescription>
        </CardHeader>
        <CardContent className="space-y-6">
          {/* Contact Information */}
          <div className="space-y-4">
            <h3 className="font-semibold text-slate-800 flex items-center gap-2">
              <AlertCircle className="w-4 h-4" />
              Contact Information
            </h3>
            <p className="text-sm text-slate-500">
              These details can be edited and will be saved as a snapshot with your application.
            </p>
            
            <div className="grid md:grid-cols-2 gap-4">
              <div className="space-y-2">
                <Label htmlFor="fullName">
                  Full Name * 
                  {errors.student_full_name && (
                    <span className="text-red-600 text-xs ml-2">{errors.student_full_name}</span>
                  )}
                </Label>
                <Input
                  id="fullName"
                  value={formData.student_full_name}
                  onChange={(e) => handleInputChange("student_full_name", e.target.value)}
                  className={errors.student_full_name ? "border-red-500" : ""}
                />
              </div>

              <div className="space-y-2">
                <Label htmlFor="email">
                  Email *
                  {errors.student_email && (
                    <span className="text-red-600 text-xs ml-2">{errors.student_email}</span>
                  )}
                </Label>
                <Input
                  id="email"
                  type="email"
                  value={formData.student_email}
                  onChange={(e) => handleInputChange("student_email", e.target.value)}
                  className={errors.student_email ? "border-red-500" : ""}
                />
              </div>

              {(selectedFund.application_fields?.phone?.enabled ?? true) && (
                <div className="space-y-2">
                  <Label htmlFor="phone">Phone Number {(selectedFund.application_fields?.phone?.required ?? false) && "*"}</Label>
                  <Input
                    id="phone"
                    type="tel"
                    value={formData.student_phone}
                    onChange={(e) => handleInputChange("student_phone", e.target.value)}
                    placeholder="(555) 123-4567"
                  />
                </div>
              )}
            </div>
          </div>

          {/* Request Details */}
          <div className="space-y-4 pt-4 border-t">
            <h3 className="font-semibold text-slate-800 flex items-center gap-2">
              <DollarSign className="w-4 h-4" />
              Request Details
            </h3>

            <div className="grid md:grid-cols-2 gap-4">
              <div className="space-y-2">
                <Label htmlFor="amount">
                  Requested Amount *
                  {errors.requested_amount && (
                    <span className="text-red-600 text-xs ml-2">{errors.requested_amount}</span>
                  )}
                </Label>
                <div className="relative">
                  <DollarSign className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-slate-400" />
                  <Input
                    id="amount"
                    type="number"
                    min="0"
                    step="0.01"
                    placeholder="0.00"
                    className={`pl-9 ${errors.requested_amount ? "border-red-500" : ""}`}
                    value={formData.requested_amount}
                    onChange={(e) => handleInputChange("requested_amount", e.target.value)}
                  />
                </div>
                {selectedFund.max_request_amount && (
                  <p className="text-xs text-slate-500">
                    Maximum allowed: ${selectedFund.max_request_amount.toLocaleString()}
                  </p>
                )}
              </div>

              <div className="space-y-2">
                <Label htmlFor="category">
                  Intended Use Category *
                  {errors.intended_use_category && (
                    <span className="text-red-600 text-xs ml-2">{errors.intended_use_category}</span>
                  )}
                </Label>
                <Select
                  value={formData.intended_use_category}
                  onValueChange={(value) => handleInputChange("intended_use_category", value)}
                >
                  <SelectTrigger className={errors.intended_use_category ? "border-red-500" : ""}>
                    <SelectValue placeholder="Select category" />
                  </SelectTrigger>
                  <SelectContent>
                    {(selectedFund?.allowed_categories && selectedFund.allowed_categories.length > 0
                      ? selectedFund.allowed_categories
                      : USE_CATEGORIES
                    ).map((cat) => (
                      <SelectItem key={cat} value={cat}>{cat}</SelectItem>
                    ))}
                  </SelectContent>
                </Select>
                {selectedFund?.allowed_categories && selectedFund.allowed_categories.length > 0 && (
                  <p className="text-xs text-slate-500">
                    Only selected categories are allowed for this fund
                  </p>
                )}
              </div>
            </div>

            {(selectedFund.application_fields?.intended_use_description?.enabled ?? true) && (
              <div className="space-y-2">
                <Label htmlFor="useDescription">
                  How will you use these funds? {(selectedFund.application_fields?.intended_use_description?.required ?? true) && "*"} (minimum 30 characters)
                  {errors.intended_use_description && (
                    <span className="text-red-600 text-xs ml-2">{errors.intended_use_description}</span>
                  )}
                </Label>
                <Textarea
                  id="useDescription"
                  placeholder="Provide a detailed description of how you plan to use these funds..."
                  rows={4}
                  value={formData.intended_use_description}
                  onChange={(e) => handleInputChange("intended_use_description", e.target.value)}
                  className={errors.intended_use_description ? "border-red-500" : ""}
                />
                <p className="text-xs text-slate-500">
                  {formData.intended_use_description.length} / 30 characters minimum
                </p>
              </div>
            )}

            {(selectedFund.application_fields?.justification_paragraph?.enabled ?? true) && (
              <div className="space-y-2">
                <Label htmlFor="justification">
                  Why do you deserve these funds? {(selectedFund.application_fields?.justification_paragraph?.required ?? true) && "*"} (minimum 100 characters)
                  {errors.justification_paragraph && (
                    <span className="text-red-600 text-xs ml-2">{errors.justification_paragraph}</span>
                  )}
                </Label>
                <Textarea
                  id="justification"
                  placeholder="Explain your situation, why you need this assistance, and how it will help you succeed..."
                  rows={6}
                  value={formData.justification_paragraph}
                  onChange={(e) => handleInputChange("justification_paragraph", e.target.value)}
                  className={errors.justification_paragraph ? "border-red-500" : ""}
                />
                <p className="text-xs text-slate-500">
                  {formData.justification_paragraph.length} / 100 characters minimum
                </p>
              </div>
            )}
          </div>

          {/* Attachments */}
          {(selectedFund.application_fields?.attachments?.enabled ?? true) && (
            <div className="space-y-4 pt-4 border-t">
              <h3 className="font-semibold text-slate-800 flex items-center gap-2">
                <Paperclip className="w-4 h-4" />
                Supporting Documents {(selectedFund.application_fields?.attachments?.required ?? false) && <span className="text-red-600">*</span>}
              </h3>
            <p className="text-sm text-slate-500">
              Upload any supporting documents (PDF, JPG, PNG, DOC - max 10MB per file)
              {(selectedFund.application_fields?.attachments?.required ?? false) && (
                <span className="text-amber-600 font-medium"> - Required for this fund</span>
              )}
            </p>

            <div className="border-2 border-dashed border-slate-200 rounded-xl p-6 text-center hover:border-indigo-300 transition-colors">
              <input
                type="file"
                multiple
                accept=".pdf,.jpg,.jpeg,.png,.doc,.docx"
                className="hidden"
                id="fileUpload"
                onChange={handleFileUpload}
                disabled={uploading}
              />
              <label htmlFor="fileUpload" className="cursor-pointer">
                {uploading ? (
                  <LoadingSpinner size="sm" className="mx-auto mb-2" />
                ) : (
                  <Upload className="w-8 h-8 text-slate-400 mx-auto mb-2" />
                )}
                <p className="text-sm text-slate-600">
                  {uploading ? "Uploading..." : "Click to upload documents"}
                </p>
                <p className="text-xs text-slate-400 mt-1">
                  PDF, JPG, PNG, DOC • Max 10MB per file
                </p>
              </label>
            </div>

            {formData.attachments.length > 0 && (
              <div className="space-y-2">
                <p className="text-sm font-medium text-slate-700">
                  Uploaded Files ({formData.attachments.length})
                </p>
                {formData.attachments.map((file, index) => (
                  <div
                    key={index}
                    className="flex items-center justify-between p-3 bg-slate-50 rounded-lg"
                  >
                    <div className="flex items-center gap-3 flex-1 min-w-0">
                      <File className="w-4 h-4 text-indigo-600 flex-shrink-0" />
                      <span className="text-sm text-slate-700 truncate">{file.name}</span>
                    </div>
                    <Button
                      variant="ghost"
                      size="sm"
                      onClick={() => removeAttachment(index)}
                      className="text-red-600 hover:text-red-700 hover:bg-red-50"
                    >
                      <X className="w-4 h-4" />
                    </Button>
                  </div>
                ))}
              </div>
            )}
            </div>
          )}

          {/* Action Buttons */}
          <div className="flex flex-col sm:flex-row justify-between gap-3 pt-6 border-t">
            <Button
              variant="outline"
              onClick={handleSaveAsDraft}
              disabled={submitting || !formData.requested_amount}
              className="order-2 sm:order-1"
            >
              <Save className="w-4 h-4 mr-2" />
              Save as Draft
            </Button>
            <Button
              onClick={handleSubmit}
              disabled={!isFormValid || submitting}
              className="bg-gradient-to-r from-indigo-600 to-violet-600 hover:from-indigo-700 hover:to-violet-700 order-1 sm:order-2"
            >
              <Send className="w-4 h-4 mr-2" />
              Submit Application
            </Button>
          </div>
        </CardContent>
      </Card>

      {/* Confirmation Modal */}
      <Dialog open={showConfirmModal} onOpenChange={setShowConfirmModal}>
        <DialogContent className="sm:max-w-md">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2">
              <AlertCircle className="w-5 h-5 text-amber-500" />
              Confirm Submission
            </DialogTitle>
            <DialogDescription>
              Please review your application before submitting.
            </DialogDescription>
          </DialogHeader>
          <div className="space-y-4 py-4">
            <Alert className="bg-amber-50 border-amber-200">
              <AlertTriangle className="w-4 h-4 text-amber-600" />
              <AlertDescription className="text-amber-900 text-sm">
                Once submitted, you will not be able to edit your application unless additional information is requested by a reviewer.
              </AlertDescription>
            </Alert>

            <div className="space-y-3 text-sm">
              <div className="flex justify-between">
                <span className="text-slate-500">Fund:</span>
                <span className="font-medium">{selectedFund.fund_name}</span>
              </div>
              <div className="flex justify-between">
                <span className="text-slate-500">Amount:</span>
                <span className="font-medium">${parseFloat(formData.requested_amount).toLocaleString()}</span>
              </div>
              <div className="flex justify-between">
                <span className="text-slate-500">Category:</span>
                <span className="font-medium">{formData.intended_use_category}</span>
              </div>
              <div className="flex justify-between">
                <span className="text-slate-500">Attachments:</span>
                <span className="font-medium">{formData.attachments.length} files</span>
              </div>
            </div>
          </div>
          <DialogFooter>
            <Button 
              variant="outline" 
              onClick={() => setShowConfirmModal(false)}
              disabled={submitting}
            >
              Cancel
            </Button>
            <Button
              onClick={confirmSubmit}
              disabled={submitting}
              className="bg-gradient-to-r from-indigo-600 to-violet-600 hover:from-indigo-700 hover:to-violet-700"
            >
              {submitting ? (
                <LoadingSpinner size="sm" className="mr-2" />
              ) : (
                <CheckCircle className="w-4 h-4 mr-2" />
              )}
              Confirm & Submit
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}