import React from "react";

export type StatusVariant =
  | "draft"
  | "pending"
  | "approved"
  | "rejected"
  | "active"
  | "inactive"
  | "paid"
  | "unpaid"
  | "partial"
  | "cancelled"
  | "overdue"
  | "in_progress"
  | "completed"
  | "open"
  | "closed"
  | "low_stock"
  | "out_of_stock";

interface StatusBadgeProps {
  status: StatusVariant | string;
  label?: string;
  size?: "sm" | "md" | "lg";
  className?: string;
  dot?: boolean;
}

const variantStyles: Record<string, { bg: string; text: string; dot: string }> = {
  active: { bg: "bg-emerald-500/10 dark:bg-emerald-500/20", text: "text-emerald-700 dark:text-emerald-400", dot: "bg-emerald-500" },
  approved: { bg: "bg-emerald-500/10 dark:bg-emerald-500/20", text: "text-emerald-700 dark:text-emerald-400", dot: "bg-emerald-500" },
  completed: { bg: "bg-emerald-500/10 dark:bg-emerald-500/20", text: "text-emerald-700 dark:text-emerald-400", dot: "bg-emerald-500" },
  paid: { bg: "bg-emerald-500/10 dark:bg-emerald-500/20", text: "text-emerald-700 dark:text-emerald-400", dot: "bg-emerald-500" },

  pending: { bg: "bg-amber-500/10 dark:bg-amber-500/20", text: "text-amber-700 dark:text-amber-400", dot: "bg-amber-500" },
  in_progress: { bg: "bg-blue-500/10 dark:bg-blue-500/20", text: "text-blue-700 dark:text-blue-400", dot: "bg-blue-500" },
  partial: { bg: "bg-amber-500/10 dark:bg-amber-500/20", text: "text-amber-700 dark:text-amber-400", dot: "bg-amber-500" },
  open: { bg: "bg-blue-500/10 dark:bg-blue-500/20", text: "text-blue-700 dark:text-blue-400", dot: "bg-blue-500" },

  draft: { bg: "bg-slate-500/10 dark:bg-slate-500/20", text: "text-slate-700 dark:text-slate-400", dot: "bg-slate-400" },
  inactive: { bg: "bg-slate-500/10 dark:bg-slate-500/20", text: "text-slate-600 dark:text-slate-400", dot: "bg-slate-400" },
  closed: { bg: "bg-slate-500/10 dark:bg-slate-500/20", text: "text-slate-600 dark:text-slate-400", dot: "bg-slate-400" },

  rejected: { bg: "bg-rose-500/10 dark:bg-rose-500/20", text: "text-rose-700 dark:text-rose-400", dot: "bg-rose-500" },
  cancelled: { bg: "bg-rose-500/10 dark:bg-rose-500/20", text: "text-rose-700 dark:text-rose-400", dot: "bg-rose-500" },
  overdue: { bg: "bg-rose-500/10 dark:bg-rose-500/20", text: "text-rose-700 dark:text-rose-400", dot: "bg-rose-500" },
  unpaid: { bg: "bg-rose-500/10 dark:bg-rose-500/20", text: "text-rose-700 dark:text-rose-400", dot: "bg-rose-500" },
  out_of_stock: { bg: "bg-rose-500/10 dark:bg-rose-500/20", text: "text-rose-700 dark:text-rose-400", dot: "bg-rose-500" },
  low_stock: { bg: "bg-amber-500/10 dark:bg-amber-500/20", text: "text-amber-700 dark:text-amber-400", dot: "bg-amber-500" },
};

const defaultStyle = {
  bg: "bg-slate-500/10 dark:bg-slate-500/20",
  text: "text-slate-700 dark:text-slate-400",
  dot: "bg-slate-400",
};

const sizeStyles = {
  sm: "px-2 py-0.5 text-xs",
  md: "px-2.5 py-1 text-xs",
  lg: "px-3 py-1.5 text-sm",
};

export const StatusBadge: React.FC<StatusBadgeProps> = ({
  status,
  label,
  size = "md",
  className = "",
  dot = true,
}) => {
  const normalizedKey = status.toLowerCase().replace(/[\s-]/g, "_");
  const style = variantStyles[normalizedKey] || defaultStyle;
  const displayLabel = label || status.replace(/_/g, " ").replace(/\b\w/g, (c) => c.toUpperCase());

  return (
    <span
      className={`inline-flex items-center gap-1.5 font-medium rounded-full border border-transparent select-none ${style.bg} ${style.text} ${sizeStyles[size]} ${className}`}
    >
      {dot && <span className={`h-1.5 w-1.5 rounded-full ${style.dot}`} />}
      <span>{displayLabel}</span>
    </span>
  );
};
