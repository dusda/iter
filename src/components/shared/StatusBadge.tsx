import React from "react";
import { Badge } from "@/components/ui/badge";

const statusStyles = {
  Draft: "bg-slate-100 text-slate-700 border-slate-200 dark:text-slate-200 dark:bg-slate-800 dark:border-slate-800",
  Submitted: "bg-blue-50 text-blue-700 border-blue-200 dark:bg-blue-950/30 dark:text-blue-300 dark:border-blue-900/50",
  "In Review": "bg-amber-50 text-amber-700 border-amber-200 dark:bg-amber-950/30 dark:text-amber-300 dark:border-amber-900/50",
  "Needs Info": "bg-orange-50 text-orange-700 border-orange-200 dark:bg-orange-950/30 dark:text-orange-300 dark:border-orange-900/50",
  Approved: "bg-emerald-50 text-emerald-700 border-emerald-200 dark:bg-emerald-950/30 dark:text-emerald-300 dark:border-emerald-900/50",
  Denied: "bg-red-50 text-red-700 border-red-200 dark:bg-red-950/30 dark:text-red-300 dark:border-red-900/50",
  Paid: "bg-violet-50 text-violet-700 border-violet-200 dark:bg-violet-950/30 dark:text-violet-300 dark:border-violet-900/50",
  Closed: "bg-slate-100 text-slate-600 border-slate-200 dark:text-slate-300 dark:bg-slate-800 dark:border-slate-800",
  Pending: "bg-yellow-50 text-yellow-700 border-yellow-200 dark:bg-yellow-950/30 dark:text-yellow-300 dark:border-yellow-900/50",
  active: "bg-emerald-50 text-emerald-700 border-emerald-200 dark:bg-emerald-950/30 dark:text-emerald-300 dark:border-emerald-900/50",
  invited: "bg-sky-50 text-sky-800 border-sky-200 dark:bg-sky-950/30 dark:text-sky-200 dark:border-sky-900/50",
  inactive: "bg-slate-100 text-slate-600 border-slate-200 dark:text-slate-300 dark:bg-slate-800 dark:border-slate-800",
  archived: "bg-slate-100 text-slate-500 border-slate-200 dark:text-slate-400 dark:bg-slate-800 dark:border-slate-800",
};

export default function StatusBadge({ status, className="" }) {
  const style = statusStyles[status] || "bg-slate-100 text-slate-700 border-slate-200 dark:text-slate-200 dark:bg-slate-800 dark:border-slate-800";
  
  return (
    <Badge 
      variant="outline" 
      className={`${style} border font-medium px-2.5 py-0.5 ${className}`}
    >
      {status}
    </Badge>
  );
}