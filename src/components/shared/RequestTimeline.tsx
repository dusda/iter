import React from "react";
import { CheckCircle, Clock, XCircle, AlertCircle, Send, DollarSign } from "lucide-react";

export default function RequestTimeline({ status }) {
  const timeline = [
    { 
      step: "Submitted", 
      icon: Send, 
      color: "indigo",
      completed: ["Submitted", "In Review", "Needs Info", "Approved", "Denied", "Paid", "Closed"].includes(status),
      active: status === "Submitted"
    },
    { 
      step: "In Review", 
      icon: Clock, 
      color: "amber",
      completed: ["In Review", "Needs Info", "Approved", "Denied", "Paid", "Closed"].includes(status),
      active: status === "In Review" || status === "Needs Info"
    },
    { 
      step: "Decision", 
      icon: status === "Approved" || status === "Paid" ? CheckCircle : status === "Denied" ? XCircle : AlertCircle, 
      color: status === "Approved" || status === "Paid" ? "emerald" : status === "Denied" ? "red" : "slate",
      completed: ["Approved", "Denied", "Paid", "Closed"].includes(status),
      active: status === "Approved" || status === "Denied"
    },
    { 
      step: "Disbursement", 
      icon: DollarSign, 
      color: "violet",
      completed: ["Paid", "Closed"].includes(status),
      active: status === "Paid"
    }
  ];

  const colorClasses = {
    indigo: "bg-indigo-600 text-white",
    amber: "bg-amber-500 text-white",
    emerald: "bg-emerald-600 text-white",
    red: "bg-red-600 text-white",
    violet: "bg-violet-600 text-white",
    slate: "bg-slate-300 text-slate-600 dark:text-slate-300"
  };

  return (
    <div className="relative">
      {/* Progress Line */}
      <div className="absolute top-6 left-0 right-0 h-0.5 bg-slate-200 dark:bg-slate-700">
        <div 
          className="h-full bg-linear-to-r from-indigo-500 to-violet-500 transition-all duration-500"
          style={{
            width: `${(timeline.filter(t => t.completed).length / timeline.length) * 100}%`
          }}
        />
      </div>

      {/* Timeline Steps */}
      <div className="relative flex justify-between">
        {timeline.map((item, index) => {
          const Icon = item.icon;
          
          return (
            <div key={index} className="flex flex-col items-center z-10">
              <div 
                className={`w-12 h-12 rounded-full flex items-center justify-center shadow-lg transition-all ${
                  item.completed 
                    ? colorClasses[item.color]
                    : item.active 
                    ? "bg-white border-2 border-indigo-600 text-indigo-600 animate-pulse dark:bg-slate-900"
                    : "bg-slate-100 text-slate-400 dark:text-slate-500 dark:bg-slate-800"
                }`}
              >
                <Icon className="w-5 h-5" />
              </div>
              <p className={`mt-2 text-xs md:text-sm font-medium text-center ${
                item.completed || item.active ? "text-slate-800 dark:text-slate-100" : "text-slate-400 dark:text-slate-500"
              }`}>
                {item.step}
              </p>
            </div>
          );
        })}
      </div>
    </div>
  );
}