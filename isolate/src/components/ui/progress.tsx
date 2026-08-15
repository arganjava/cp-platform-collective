import * as React from "react";
import { cn } from "@/lib/utils";

interface ProgressProps extends React.HTMLAttributes<HTMLDivElement> {
  value?: number;
  max?: number;
  color?: string;
  label?: string;
}

const Progress = React.forwardRef<HTMLDivElement, ProgressProps>(({ className, value = 0, max = 100, color, label, ...props }, ref) => {
  const safeMax = Math.max(max, 1);
  const safeValue = Math.min(Math.max(value, 0), safeMax);
  const percentage = (safeValue / safeMax) * 100;
  return (
    <div ref={ref} role="progressbar" aria-label={label || "Progress"} aria-valuemin={0} aria-valuemax={safeMax} aria-valuenow={safeValue} className={cn("relative h-2 w-full overflow-hidden bg-secondary", className)} {...props}>
      <div className="h-full transition-[width] duration-300 ease-out" style={{ width: `${percentage}%`, backgroundColor: color || "var(--primary)" }} />
    </div>
  );
});
Progress.displayName = "Progress";

export { Progress };
