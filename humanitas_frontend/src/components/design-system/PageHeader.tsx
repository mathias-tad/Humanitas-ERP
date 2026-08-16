import React from "react";
import { ChevronRight, Home } from "lucide-react";
import { Link } from "react-router-dom";

export interface BreadcrumbItem {
  label: string;
  href?: string;
}

export interface PageHeaderProps {
  title: string;
  description?: string;
  badge?: React.ReactNode;
  breadcrumbs?: BreadcrumbItem[];
  actions?: React.ReactNode;
  className?: string;
}

export const PageHeader: React.FC<PageHeaderProps> = ({
  title,
  description,
  badge,
  breadcrumbs,
  actions,
  className = "",
}) => {
  return (
    <div className={`space-y-2 pb-5 border-b border-border/80 ${className}`}>
      {/* Breadcrumb Navigation */}
      {breadcrumbs && breadcrumbs.length > 0 && (
        <nav className="flex items-center gap-1.5 text-xs text-muted-foreground">
          <Link
            to="/dashboard"
            className="hover:text-foreground transition-colors flex items-center gap-1"
          >
            <Home className="h-3.5 w-3.5" />
          </Link>
          {breadcrumbs.map((item, idx) => (
            <React.Fragment key={idx}>
              <ChevronRight className="h-3 w-3 text-muted-foreground/50 shrink-0" />
              {item.href && idx < breadcrumbs.length - 1 ? (
                <Link
                  to={item.href}
                  className="hover:text-foreground transition-colors font-medium"
                >
                  {item.label}
                </Link>
              ) : (
                <span className="text-foreground font-semibold truncate">
                  {item.label}
                </span>
              )}
            </React.Fragment>
          ))}
        </nav>
      )}

      {/* Main Title & Context Actions */}
      <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
        <div className="space-y-0.5">
          <div className="flex items-center gap-3">
            <h1 className="text-2xl font-bold tracking-tight text-foreground">{title}</h1>
            {badge}
          </div>
          {description && (
            <p className="text-sm text-muted-foreground max-w-2xl">{description}</p>
          )}
        </div>

        {actions && (
          <div className="flex items-center gap-2 flex-wrap shrink-0">
            {actions}
          </div>
        )}
      </div>
    </div>
  );
};
