import { Suspense } from "react";
import { JamDetailClient } from "./client";

export default function JamDetailPage() {
  return (
    <Suspense
      fallback={
        <div className="flex h-screen items-center justify-center">
          <p className="text-sm text-muted-foreground">Loading...</p>
        </div>
      }
    >
      <JamDetailClient />
    </Suspense>
  );
}
