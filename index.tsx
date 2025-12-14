
import React, { useState, useEffect } from "react";
import { createRoot } from "react-dom/client";
import PreviewLayout from "./app/preview-layout";
import Home from "./app/page";
import PoliciesPage from "./app/policies/page";
import SubmitPage from "./app/submit/page";
import ConclusionRoute from "./app/conclusion/page";
import ArxivReviewPage from "./app/arxiv/page";
import MarketPage from "./app/market/page";
import KeywordMapPage from "./app/map/page";
import ProfilePage from "./app/profile/page";
import PlaybookPage from "./app/play/page";
import { usePathname } from "./lib/mocks/navigation";

const App = () => {
  const pathname = usePathname();

  // Simple client-side routing
  let Component;
  if (pathname === "/" || pathname === "") {
    Component = Home;
  } else if (pathname === "/policies") {
    Component = PoliciesPage;
  } else if (pathname === "/submit") {
    Component = SubmitPage;
  } else if (pathname === "/conclusion") {
    Component = ConclusionRoute;
  } else if (pathname === "/arxiv") {
    Component = ArxivReviewPage;
  } else if (pathname === "/market") {
    Component = MarketPage;
  } else if (pathname === "/map") {
    Component = KeywordMapPage;
  } else if (pathname === "/profile") {
    Component = ProfilePage;
  } else if (pathname === "/play") {
    Component = PlaybookPage;
  } else if (pathname.startsWith("/card/")) {
    Component = () => (
      <div className="container py-16">
        <div className="max-w-2xl mx-auto space-y-3 border border-zinc-800 bg-zinc-950/50 p-6">
          <div className="text-[10px] font-mono text-zinc-600">PREVIEW_MODE</div>
          <div className="text-lg font-serif text-zinc-100">Review cards require the Next.js server runtime.</div>
          <div className="text-sm text-zinc-500">
            Run the full app locally with <span className="font-mono text-emerald-500">npm run dev</span> and open this URL again.
          </div>
        </div>
      </div>
    );
  } else {
    // 404 fallback
    Component = () => (
      <div className="flex h-screen w-full items-center justify-center text-emerald-500 font-mono">
        404 | SECTION_NOT_FOUND
      </div>
    );
  }

  return (
    <PreviewLayout>
      <Component />
    </PreviewLayout>
  );
};

const rootElement = document.getElementById("root");
if (rootElement) {
  const root = createRoot(rootElement);
  root.render(<App />);
}
