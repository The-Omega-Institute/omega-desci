import React, { Suspense } from "react";
import { ConclusionPage } from "@/components/conclusion/ConclusionPage";

export default function ConclusionRoute() {
  return (
    <Suspense
      fallback={
        <div className="min-h-screen flex items-center justify-center text-emerald-500 font-mono">
          LOADING_CONCLUSION...
        </div>
      }
    >
      <ConclusionPage />
    </Suspense>
  );
}
