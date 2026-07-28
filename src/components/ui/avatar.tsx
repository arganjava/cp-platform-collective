import * as React from "react";
import { cn } from "@/lib/utils";

const Avatar = React.forwardRef<HTMLDivElement, React.HTMLAttributes<HTMLDivElement> & { color?: string; size?: "sm" | "md" | "lg" }>(
  ({ className, color, size = "md", children, ...props }, ref) => {
    const sizeClasses = { sm: "h-6 w-6 text-[10px]", md: "h-8 w-8 text-xs", lg: "h-10 w-10 text-sm" };
    return (
      <div
        ref={ref}
        className={cn("relative flex shrink-0 overflow-hidden rounded-full items-center justify-center font-semibold text-white", sizeClasses[size], className)}
        style={color ? { backgroundColor: color } : undefined}
        {...props}
      >
        {children}
      </div>
    );
  }
);
Avatar.displayName = "Avatar";

export { Avatar };
