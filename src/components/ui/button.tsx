import * as React from "react";
import { Slot } from "@radix-ui/react-slot";
import { cva, type VariantProps } from "class-variance-authority";
import { cn } from "@/lib/utils";

const buttonVariants = cva(
  "inline-flex items-center justify-center gap-2 whitespace-nowrap rounded-[10px] text-sm font-medium transition-all duration-200 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-cp-purple-500 focus-visible:ring-offset-2 disabled:pointer-events-none disabled:opacity-50 cursor-pointer",
  {
    variants: {
      variant: {
        default: "bg-cp-purple-600 text-white hover:bg-cp-purple-700 shadow-sm hover:shadow-md active:scale-[0.98]",
        destructive: "bg-cp-coral-500 text-white hover:bg-cp-coral-600 shadow-sm active:scale-[0.98]",
        outline: "border border-border-default bg-white hover:bg-surface-sunken hover:border-border-strong",
        secondary: "bg-surface-sunken text-text-primary hover:bg-border-default",
        ghost: "hover:bg-surface-sunken",
        link: "text-cp-purple-600 underline-offset-4 hover:underline",
        coral: "bg-cp-coral-500 text-white hover:bg-cp-coral-600 shadow-sm active:scale-[0.98]",
        teal: "bg-cp-teal-500 text-white hover:bg-cp-teal-600 shadow-sm active:scale-[0.98]",
        mustard: "bg-cp-mustard-500 text-text-primary hover:bg-cp-mustard-600 shadow-sm active:scale-[0.98]",
        gradient: "gradient-brand text-white shadow-sm hover:shadow-md active:scale-[0.98]",
      },
      size: {
        default: "h-9 px-4 py-2",
        sm: "h-8 rounded-lg px-3 text-xs",
        lg: "h-11 rounded-xl px-8 text-base",
        icon: "h-9 w-9",
        "icon-sm": "h-8 w-8",
      },
    },
    defaultVariants: {
      variant: "default",
      size: "default",
    },
  }
);

export interface ButtonProps
  extends React.ButtonHTMLAttributes<HTMLButtonElement>,
    VariantProps<typeof buttonVariants> {
  asChild?: boolean;
}

const Button = React.forwardRef<HTMLButtonElement, ButtonProps>(
  ({ className, variant, size, asChild = false, ...props }, ref) => {
    const Comp = asChild ? Slot : "button";
    return (
      <Comp
        className={cn(buttonVariants({ variant, size, className }))}
        ref={ref}
        {...props}
      />
    );
  }
);
Button.displayName = "Button";

export { Button, buttonVariants };
