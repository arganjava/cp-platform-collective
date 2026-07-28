import * as React from "react";
import { cva, type VariantProps } from "class-variance-authority";
import { cn } from "@/lib/utils";

const badgeVariants = cva(
  "inline-flex items-center rounded-full px-2.5 py-0.5 text-xs font-medium transition-colors",
  {
    variants: {
      variant: {
        default: "bg-cp-purple-100 text-cp-purple-800",
        secondary: "bg-surface-sunken text-text-secondary",
        success: "bg-cp-teal-100 text-cp-teal-800",
        warning: "bg-cp-mustard-100 text-cp-mustard-800",
        danger: "bg-cp-coral-100 text-cp-coral-800",
        outline: "border border-border-default text-text-secondary",
        purple: "bg-cp-purple-100 text-cp-purple-800",
        coral: "bg-cp-coral-100 text-cp-coral-800",
        teal: "bg-cp-teal-100 text-cp-teal-800",
        mustard: "bg-cp-mustard-100 text-cp-mustard-800",
      },
    },
    defaultVariants: {
      variant: "default",
    },
  }
);

export interface BadgeProps
  extends React.HTMLAttributes<HTMLDivElement>,
    VariantProps<typeof badgeVariants> {}

function Badge({ className, variant, ...props }: BadgeProps) {
  return <div className={cn(badgeVariants({ variant }), className)} {...props} />;
}

export { Badge, badgeVariants };
