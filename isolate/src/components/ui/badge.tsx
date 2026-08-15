import * as React from "react";
import { cva, type VariantProps } from "class-variance-authority";
import { cn } from "@/lib/utils";

const badgeVariants = cva("inline-flex items-center px-2 py-0.5 text-[11px] font-semibold uppercase tracking-wider leading-tight transition-colors", {
  variants: {
    variant: {
      neutral: "bg-secondary text-muted-foreground",
      accent: "bg-accent text-accent-foreground",
      positive: "bg-primary text-white",
      warning: "border border-cp-coral-300 text-destructive",
      danger: "bg-brand text-white",
      outline: "border border-border text-muted-foreground",
    },
  },
  defaultVariants: { variant: "neutral" },
});

export interface BadgeProps extends React.HTMLAttributes<HTMLDivElement>, VariantProps<typeof badgeVariants> {}
function Badge({ className, variant, ...props }: BadgeProps) {
  return <div className={cn(badgeVariants({ variant }), className)} {...props} />;
}

export { Badge, badgeVariants };
