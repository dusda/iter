import React from "react";
import { FileX } from "lucide-react";

interface EmptyStateProps {
  icon?: React.ComponentType<React.SVGProps<SVGSVGElement>>;
  title: React.ReactNode;
  description?: React.ReactNode;
  action?: React.ReactNode;
}

export default function EmptyState({
  icon: Icon = FileX,
  title,
  description,
  action,
}: EmptyStateProps) {
  return (
    <div className="flex flex-col items-center justify-center py-16 px-4 text-center">
      <div className="w-16 h-16 bg-slate-100 rounded-2xl flex items-center justify-center mb-4 dark:bg-slate-800">
        <Icon className="w-8 h-8 text-slate-400 dark:text-slate-500" />
      </div>
      <h3 className="text-lg font-semibold text-slate-800 mb-1 dark:text-slate-100">{title}</h3>
      {description && (
        <p className="text-slate-500 text-sm max-w-sm mb-4 dark:text-slate-400">{description}</p>
      )}
      {action}
    </div>
  );
}