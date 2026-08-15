import Link from "next/link";
import { Button } from "@/components/ui/button";

export default function NotFound() {
  return (
    <div className="min-h-screen bg-background flex items-center justify-center">
      <div className="text-center space-y-4 max-w-md px-4">
        <div className="h-px w-12 bg-brand mx-auto" aria-hidden="true" />
        <h2 className="text-xl font-bold heading">Page Not Found</h2>
        <p className="text-muted-foreground text-sm">
          The page you&apos;re looking for doesn&apos;t exist or has been moved.
        </p>
        <Link href="/">
          <Button variant="default">Back to Dashboard</Button>
        </Link>
      </div>
    </div>
  );
}
