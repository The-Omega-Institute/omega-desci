import Link from "next/link";
import { Separator } from "@/components/ui/shadcn";

export function Footer() {
  const policies = [
    "Scope and Article Types",
    "Provenance and Tooling Statement",
    "Open Peer Review Norms",
    "Data and Code Availability",
    "Ethical Standards",
    "Dispute Arbitration"
  ];

  return (
    <footer className="border-t border-zinc-800 bg-zinc-950 py-6 md:py-0">
      <div className="container flex flex-col items-center justify-between gap-4 md:h-24 md:flex-row">
        <div className="flex flex-col items-center gap-4 px-8 md:flex-row md:gap-2 md:px-0">
          <p className="text-center text-sm leading-loose text-muted-foreground md:text-left">
            Built by{" "}
            <a
              href="#"
              className="font-medium underline underline-offset-4 text-emerald-500 hover:text-emerald-400"
            >
              aelf
            </a>
            . Governed by{" "}
            <a
              href="#"
              className="font-medium underline underline-offset-4 text-indigo-500 hover:text-indigo-400"
            >
              TomorrowDAO
            </a>
            .
          </p>
        </div>
        
        <div className="flex gap-4 text-xs text-zinc-500 font-mono">
           <span>Last Updated: 2024-05-21T14:00:00Z</span>
        </div>
      </div>
      
      <Separator />
      
      <div className="container py-6">
        <div className="flex flex-wrap justify-center gap-x-8 gap-y-2 text-sm text-zinc-400">
          {policies.map((policy, i) => (
             <Link key={i} href="/policies" className="hover:text-emerald-500 transition-colors">
               {policy}
             </Link>
          ))}
        </div>
      </div>
    </footer>
  );
}
