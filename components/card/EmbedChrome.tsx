"use client";

import { useEffect } from "react";
import { useSearchParams } from "next/navigation";

export function EmbedChrome() {
  const searchParams = useSearchParams();

  useEffect(() => {
    const embed = (searchParams.get("embed") || "").trim();
    if (embed !== "1" && embed.toLowerCase() !== "true") return;

    const header = document.querySelector("header");
    const footer = document.querySelector("footer");
    header?.remove();
    footer?.remove();

    document.body.classList.add("omega-embed");
    return () => {
      document.body.classList.remove("omega-embed");
    };
  }, [searchParams]);

  return null;
}

