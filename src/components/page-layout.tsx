import * as React from "react";
import { cn } from "@/lib/utils";

interface PageFrameProps extends React.HTMLAttributes<HTMLDivElement> {
  children: React.ReactNode;
}

export function PageFrame({ className, children, ...props }: PageFrameProps) {
  return (
    <div className={cn("mx-auto w-full max-w-[1280px] space-y-8 animate-fade-in", className)} {...props}>
      {children}
    </div>
  );
}

interface TitleBlockProps {
  title: string;
  description?: string;
  actions?: React.ReactNode;
  meta?: React.ReactNode;
  className?: string;
}

export function TitleBlock({ title, description, actions, meta, className }: TitleBlockProps) {
  return (
    <header className={cn("border-b border-border pb-6", className)}>
      <div className="flex flex-col gap-4 sm:flex-row sm:items-start sm:justify-between">
        <div className="min-w-0 max-w-3xl">
          <h1 className="font-heading text-3xl font-bold leading-tight tracking-tight text-foreground">{title}</h1>
          {description && <p className="mt-2 max-w-2xl text-sm leading-6 text-muted-foreground">{description}</p>}
        </div>
        {actions && <div className="flex shrink-0 flex-wrap items-center gap-2">{actions}</div>}
      </div>
      {meta && (
        <div className="mt-4 flex flex-wrap items-center gap-x-6 gap-y-1 text-xs font-medium uppercase tracking-wider text-subtle-foreground tabular">
          {meta}
        </div>
      )}
    </header>
  );
}

export function SheetSummary({ className, children, ...props }: React.HTMLAttributes<HTMLDivElement>) {
  return (
    <div className={cn("grid grid-cols-2 divide-x divide-y-0 divide-border border-y border-border sm:grid-cols-4", className)} {...props}>
      {children}
    </div>
  );
}

interface SummaryMetricProps extends React.HTMLAttributes<HTMLDivElement> {
  value: React.ReactNode;
  label: string;
  indicator?: React.ReactNode;
  className?: string;
}

export function SummaryMetric({ value, label, indicator, className, ...props }: SummaryMetricProps) {
  return (
    <div className={cn("flex min-w-0 flex-col gap-1 px-3 py-4 first:pl-3 sm:px-6 sm:py-5", className)} {...props}>
      <div className="flex flex-col items-start gap-1 sm:flex-row sm:items-baseline sm:gap-2">
        <span className="font-heading text-2xl font-bold tracking-tight text-foreground tabular">{value}</span>
        {indicator}
      </div>
      <span className="text-xs font-medium uppercase tracking-wider text-subtle-foreground">{label}</span>
    </div>
  );
}

export function ContentGrid({ className, children, ...props }: React.HTMLAttributes<HTMLDivElement>) {
  return <div className={cn("grid min-w-0 gap-6 xl:grid-cols-2", className)} {...props}>{children}</div>;
}

export function Toolbar({ className, children, ...props }: React.HTMLAttributes<HTMLDivElement>) {
  return (
    <div className={cn("flex flex-col gap-3 border border-border bg-card p-3 sm:flex-row sm:flex-wrap sm:items-center", className)} {...props}>
      {children}
    </div>
  );
}

export function Section({ className, children, ...props }: React.HTMLAttributes<HTMLElement>) {
  return <section className={cn("min-w-0 space-y-4", className)} {...props}>{children}</section>;
}

// Backward-compatible aliases for pages still using old names.
export const PageHeader = TitleBlock;
export const MetricGrid = SheetSummary;
export function MetricCard({ value, label, meta, className }: { value: React.ReactNode; label: string; meta?: React.ReactNode; className?: string }) {
  return <SummaryMetric value={value} label={label} indicator={meta} className={className} />;
}
