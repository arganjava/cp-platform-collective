import Link from "next/link";
import { Button } from "@/components/ui/button";

export default function NotFound() {
  return (
    <div className="min-h-screen bg-surface flex items-center justify-center">
      <div className="text-center space-y-4">
        <div className="w-16 h-16 rounded-2xl bg-cp-purple-100 flex items-center justify-center mx-auto">
          <span className="text-2xl">🔍</span>
        </div>
        <h2 className="text-xl font-bold font-[family-name:var(--font-heading)]">Page Not Found</h2>
        <p className="text-text-secondary text-sm max-w-md">
          The page you&apos;re looking for doesn&apos;t exist or has been moved.
        </p>
        <Link href="/">
          <Button variant="default">Back to Dashboard</Button>
        </Link>
      </div>
    </div>
  );
}
