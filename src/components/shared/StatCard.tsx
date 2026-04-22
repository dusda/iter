import React from "react";
import { Card } from "@/components/ui/card";
import { cn } from "@/lib/utils";

type StatCardColor =
  | "indigo"
  | "violet"
  | "emerald"
  | "amber"
  | "rose"
  | "blue";

export interface StatCardProps {
  title: string;
  value: string | number;
  icon?: React.ComponentType<React.SVGProps<SVGSVGElement>>;
  trend?: string;
  trendUp?: boolean;
  color?: StatCardColor;
  /** When set, the card is focusable and acts as a control (keyboard: Enter / Space). */
  onClick?: () => void;
  "aria-label"?: string;
  "aria-expanded"?: boolean;
}

export default function StatCard({
  title,
  value,
  icon: Icon,
  trend,
  trendUp,
  color = "indigo",
  onClick,
  "aria-label": ariaLabel,
  "aria-expanded": ariaExpanded,
}: StatCardProps) {
  const interactive = typeof onClick === "function";

  const colorClasses: Record<StatCardColor, string> = {
    indigo: "from-indigo-500 to-indigo-600 shadow-indigo-500/25",
    violet: "from-violet-500 to-violet-600 shadow-violet-500/25",
    emerald: "from-emerald-500 to-emerald-600 shadow-emerald-500/25",
    amber: "from-amber-500 to-amber-600 shadow-amber-500/25",
    rose: "from-rose-500 to-rose-600 shadow-rose-500/25",
    blue: "from-blue-500 to-blue-600 shadow-blue-500/25",
  };

  return (
    <Card
      className={cn(
        "p-6 bg-white/70 backdrop-blur-xs border-slate-200/50 hover:shadow-lg transition-all duration-300 dark:bg-slate-900/70 dark:border-slate-800/50",
        interactive &&
          "cursor-pointer select-none focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-indigo-500 focus-visible:ring-offset-2"
      )}
      onClick={interactive ? onClick : undefined}
      onKeyDown={
        interactive
          ? (e) => {
              if (e.key === "Enter" || e.key === " ") {
                e.preventDefault();
                onClick();
              }
            }
          : undefined
      }
      role={interactive ? "button" : undefined}
      tabIndex={interactive ? 0 : undefined}
      aria-label={interactive ? (ariaLabel ?? `${title}: ${value}.`) : undefined}
      aria-expanded={interactive ? ariaExpanded : undefined}
    >
      <div className="flex items-start justify-between">
        <div className="space-y-1">
          <p className="text-sm font-medium text-slate-500 dark:text-slate-400">{title}</p>
          <p className="text-2xl md:text-3xl font-bold text-slate-900 dark:text-slate-50">{value}</p>
          {trend && (
            <p className={`text-xs font-medium ${trendUp ? "text-emerald-600 dark:text-emerald-400" : "text-slate-500 dark:text-slate-400"}`}>
              {trend}
            </p>
          )}
        </div>
        {Icon && (
          <div className={`w-12 h-12 rounded-xl bg-linear-to-br ${colorClasses[color]} shadow-lg flex items-center justify-center`}>
            <Icon className="w-6 h-6 text-white" />
          </div>
        )}
      </div>
    </Card>
  );
}