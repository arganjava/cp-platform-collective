import * as React from "react";
import { Slot } from "@radix-ui/react-slot";
import { cva, type VariantProps } from "class-variance-authority";
import { cn } from "@/lib/utils";

const buttonVariants = cva(
  "inline-flex min-h-10 items-center justify-center gap-2 whitespace-nowrap text-sm font-semibold transition-colors duration-150 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2 disabled:pointer-events-none disabled:opacity-50 cursor-pointer",
  {
    variants: {
      variant: {
        default: "bg-primary text-primary-foreground hover:bg-primary/85",
        destructive: "bg-destructive text-destructive-foreground hover:bg-destructive/80",
        outline: "border border-border bg-card text-foreground hover:bg-secondary hover:border-input",
        secondary: "bg-secondary text-foreground hover:bg-muted",
        ghost: "text-muted-foreground hover:bg-secondary hover:text-foreground",
        link: "text-destructive underline-offset-4 hover:underline",
        accent: "bg-brand text-white hover:bg-brand/90",
        positive: "bg-primary text-primary-foreground hover:bg-primary/85",
      },
      size: {
        default: "px-4 py-2",
        sm: "min-h-10 px-3 text-sm",
        lg: "min-h-11 px-6 text-base",
        icon: "h-11 w-11",
        "icon-sm": "h-10 w-10",
      },
    },
    defaultVariants: { variant: "default", size: "default" },
  }
);

export interface ButtonProps extends React.ButtonHTMLAttributes<HTMLButtonElement>, VariantProps<typeof buttonVariants> {
  asChild?: boolean;
}

const Button = React.forwardRef<HTMLButtonElement, ButtonProps>(({ className, variant, size, asChild = false, ...props }, ref) => {
  const Comp = asChild ? Slot : "button";
  return <Comp className={cn(buttonVariants({ variant, size, className }))} ref={ref} {...props} />;
});
Button.displayName = "Button";

export { Button, buttonVariants };
