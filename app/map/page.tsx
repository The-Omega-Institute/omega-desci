import React, { Suspense } from "react";
import MapClient from "./MapClient";

export default function KeywordMapRoute() {
  return (
    <Suspense
      fallback={
        <div className="min-h-screen flex items-center justify-center text-emerald-500 font-mono">
          LOADING_MAP...
        </div>
      }
    >
      <MapClient />
    </Suspense>
  );
}

