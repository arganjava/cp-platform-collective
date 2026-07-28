"use client";

import { useEffect } from "react";
import { Button } from "@/components/ui/button";

export default function Error({
  error,
  reset,
}: {
  error: Error & { digest?: string };
  reset: () => void;
}) {
  useEffect(() => {
    console.error(error);
  }, [error]);

  return (
    <div className="min-h-screen bg-surface flex items-center justify-center">
      <div className="text-center space-y-4">
        <div className="w-16 h-16 rounded-2xl bg-cp-coral-100 flex items-center justify-center mx-auto">
          <span className="text-2xl">⚠️</span>
        </div>
        <h2 className="text-xl font-bold font-[family-name:var(--font-heading)]">Something went wrong</h2>
        <p className="text-text-secondary text-sm max-w-md">
          An unexpected error occurred. Please try again.
        </p>
        <Button onClick={reset} variant="default">
          Try again
        </Button>
      </div>
    </div>
  );
}
