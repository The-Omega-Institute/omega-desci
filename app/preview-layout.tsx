import React from "react";
import { Inter, JetBrains_Mono, IBM_Plex_Serif } from "next/font/google";
import { Header } from "@/components/layout/Header";
import { Footer } from "@/components/layout/Footer";
import { cn } from "@/lib/utils";

const inter = Inter({ subsets: ["latin"], variable: "--font-inter" });
const jetbrains = JetBrains_Mono({ subsets: ["latin"], variable: "--font-jetbrains" });
const plexSerif = IBM_Plex_Serif({
  weight: ["400", "700"],
  subsets: ["latin"],
  variable: "--font-plex-serif",
});

export default function PreviewLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <div
      className={cn(
        "min-h-screen bg-zinc-950 font-sans antialiased text-zinc-100 selection:bg-emerald-500/30 flex flex-col",
        inter.variable,
        jetbrains.variable,
        plexSerif.variable
      )}
    >
      <div className="fixed inset-0 z-[-1] pointer-events-none bg-[url('https://grainy-gradients.vercel.app/noise.svg')] opacity-5"></div>
      <div className="fixed inset-0 z-[-1] pointer-events-none bg-[linear-gradient(rgba(18,18,18,0)_1px,transparent_1px),linear-gradient(90deg,rgba(18,18,18,0)_1px,transparent_1px)] bg-[size:40px_40px] [background-position:center_top] border-zinc-900/20"></div>

      <Header />
      <main className="flex-1 min-h-screen">{children}</main>
      <Footer />
    </div>
  );
}
