import React from "react";
import { TrendingUp, TrendingDown, Minus, type LucideIcon } from "lucide-react";

export interface KPITileProps {
  title: string;
  value: string | number;
  subtitle?: string;
  change?: number; // e.g. +12.5 or -3.2
  changeLabel?: string; // e.g. "vs last month"
  icon?: LucideIcon;
  iconColor?: string;
  iconBg?: string;
  className?: string;
  onClick?: () => void;
}

export const KPITile: React.FC<KPITileProps> = ({
  title,
  value,
  subtitle,
  change,
  changeLabel = "vs prior period",
  icon: Icon,
  iconColor = "text-primary",
  iconBg = "bg-primary/10",
  className = "",
  onClick,
}) => {
  const isPositive = change !== undefined && change > 0;
  const isNegative = change !== undefined && change < 0;
  const isNeutral = change !== undefined && change === 0;

  return (
    <div
      onClick={onClick}
      className={`relative overflow-hidden rounded-xl border border-border bg-card p-5 shadow-sm transition-all duration-200 hover:shadow-md ${
        onClick ? "cursor-pointer hover:border-primary/50" : ""
      } ${className}`}
    >
      <div className="flex items-start justify-between">
        <div className="space-y-1">
          <p className="text-xs font-semibold uppercase tracking-wider text-muted-foreground">
            {title}
          </p>
          <p className="text-2xl font-bold tracking-tight text-foreground">{value}</p>
        </div>

        {Icon && (
          <div className={`flex h-11 w-11 shrink-0 items-center justify-center rounded-xl ${iconBg}`}>
            <Icon className={`h-5 w-5 ${iconColor}`} />
          </div>
        )}
      </div>

      {(change !== undefined || subtitle) && (
        <div className="mt-3 flex items-center gap-2 pt-2 border-t border-border/50 text-xs">
          {change !== undefined && (
            <span
              className={`inline-flex items-center gap-0.5 font-semibold rounded-md px-1.5 py-0.5 ${
                isPositive
                  ? "bg-emerald-500/10 text-emerald-600 dark:text-emerald-400"
                  : isNegative
                  ? "bg-rose-500/10 text-rose-600 dark:text-rose-400"
                  : "bg-slate-500/10 text-slate-600 dark:text-slate-400"
              }`}
            >
              {isPositive && <TrendingUp className="h-3 w-3" />}
              {isNegative && <TrendingDown className="h-3 w-3" />}
              {isNeutral && <Minus className="h-3 w-3" />}
              {isPositive ? `+${change}%` : `${change}%`}
            </span>
          )}
          <span className="text-muted-foreground truncate">
            {subtitle || changeLabel}
          </span>
        </div>
      )}
    </div>
  );
};
