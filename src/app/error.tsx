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
    <div className="min-h-screen bg-background flex items-center justify-center">
      <div className="text-center space-y-4 max-w-md px-4">
        <div className="h-px w-12 bg-brand mx-auto" aria-hidden="true" />
        <h2 className="text-xl font-bold heading">Something went wrong</h2>
        <p className="text-muted-foreground text-sm">
          An unexpected error occurred. Please try again.
        </p>
        <Button onClick={reset} variant="default">
          Try again
        </Button>
      </div>
    </div>
  );
}
