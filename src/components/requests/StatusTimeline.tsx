import React from "react";
import { CheckCircle, Clock, XCircle, AlertCircle, DollarSign, Send, FileText } from "lucide-react";
import { format } from "date-fns";

const timelineSteps = [
  { key: "submitted", label: "Submitted", icon: Send },
  { key: "review", label: "In Review", icon: FileText },
  { key: "decision", label: "Decision", icon: AlertCircle },
  { key: "disbursement", label: "Disbursement", icon: DollarSign }
];

export default function StatusTimeline({ request, reviews = [], disbursements = [] }) {
  const getStepStatus = (stepKey) => {
    switch (stepKey) {
      case "submitted":
        return request.submitted_at ? "completed" : "pending";
      
      case "review":
        if (["Denied", "Approved", "Paid", "Closed"].includes(request.status)) {
          return "completed";
        }
        if (["Submitted", "In Review", "Needs Info"].includes(request.status)) {
          return "active";
        }
        return "pending";
      
      case "decision":
        if (request.status === "Approved" || request.status === "Paid" || request.status === "Closed") {
          return "completed";
        }
        if (request.status === "Denied") {
          return "denied";
        }
        return "pending";
      
      case "disbursement":
        if (request.status === "Paid" || request.status === "Closed") {
          return "completed";
        }
        if (request.status === "Approved") {
          return "active";
        }
        return "pending";
      
      default:
        return "pending";
    }
  };

  const getStepDate = (stepKey) => {
    switch (stepKey) {
      case "submitted":
        return request.submitted_at ? new Date(request.submitted_at) : null;
      
      case "review":
        const firstReview = reviews.find(r => r.decision !== "Pending");
        return firstReview ? new Date(firstReview.created_date) : null;
      
      case "decision":
        if (request.status === "Approved" || request.status === "Denied") {
          const finalReview = reviews.find(r => ["Approved", "Denied"].includes(r.decision));
          return finalReview ? new Date(finalReview.decided_at || finalReview.created_date) : null;
        }
        return null;
      
      case "disbursement":
        if (disbursements.length > 0) {
          return new Date(disbursements[0].paid_at);
        }
        return null;
      
      default:
        return null;
    }
  };

  return (
    <div className="relative">
      {/* Timeline Line */}
      <div className="absolute top-5 left-5 right-5 h-0.5 bg-slate-200 dark:bg-slate-700" />
      
      {/* Steps */}
      <div className="relative flex justify-between">
        {timelineSteps.map((step, index) => {
          const status = getStepStatus(step.key);
          const date = getStepDate(step.key);
          const Icon = step.icon;
          
          const statusColors = {
            completed: "bg-emerald-500 text-white border-emerald-500",
            active: "bg-indigo-500 text-white border-indigo-500 animate-pulse",
            denied: "bg-red-500 text-white border-red-500",
            pending: "bg-white text-slate-400 border-slate-200 dark:text-slate-500 dark:bg-slate-900 dark:border-slate-800"
          };

          const lineColors = {
            completed: "bg-emerald-500",
            active: "bg-linear-to-r from-emerald-500 to-slate-200",
            denied: "bg-red-500",
            pending: "bg-slate-200 dark:bg-slate-700"
          };

          return (
            <div key={step.key} className="flex flex-col items-center relative" style={{ width: '25%' }}>
              {/* Progress Line for completed steps */}
              {index > 0 && status !== "pending" && (
                <div 
                  className={`absolute top-5 right-1/2 h-0.5 ${lineColors[status]}`}
                  style={{ width: '100%', left: '-50%' }}
                />
              )}
              
              {/* Step Circle */}
              <div 
                className={`w-10 h-10 rounded-full border-2 flex items-center justify-center transition-all z-10 ${statusColors[status]}`}
              >
                {status === "completed" ? (
                  <CheckCircle className="w-5 h-5" />
                ) : status === "denied" ? (
                  <XCircle className="w-5 h-5" />
                ) : status === "active" ? (
                  <Icon className="w-5 h-5" />
                ) : (
                  <Icon className="w-5 h-5" />
                )}
              </div>
              
              {/* Step Label */}
              <div className="mt-3 text-center">
                <p className={`text-sm font-medium ${
                  status === "completed" || status === "active" ? "text-slate-800 dark:text-slate-100" : "text-slate-400 dark:text-slate-500"
                }`}>
                  {step.label}
                </p>
                {date && (
                  <p className="text-xs text-slate-500 mt-1 dark:text-slate-400">
                    {format(date, "MMM d, yyyy")}
                  </p>
                )}
                {status === "active" && !date && (
                  <p className="text-xs text-indigo-600 mt-1 font-medium">
                    In Progress
                  </p>
                )}
              </div>
            </div>
          );
        })}
      </div>
    </div>
  );
}