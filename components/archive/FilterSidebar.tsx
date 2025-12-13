"use client";

import Link from "next/link";
import { Badge, Button, Separator } from "@/components/ui/shadcn";

export function FilterSidebar() {
  const disciplines = [
    "Digital Physics", "Cellular Automata", "Thermodynamics", "AI Foundations", "Cosmology"
  ];

  return (
    <aside className="space-y-8 pr-4">
      {/* Scope Summary */}
      <div className="space-y-4">
        <h3 className="text-sm font-bold text-zinc-100 uppercase tracking-widest border-b border-zinc-800 pb-2">Scope Summary</h3>
        <p className="text-xs text-zinc-400 leading-relaxed italic">
          &ldquo;Omega publishes high-variance, falsifiable research. Claims must include assumptions and a test path.&rdquo;
        </p>
        <div className="flex flex-wrap gap-2">
          {disciplines.map(d => (
            <Badge key={d} variant="outline" className="text-[10px] border-zinc-700 text-zinc-500">
              {d}
            </Badge>
          ))}
        </div>
      </div>

      <Separator />

      {/* Filters */}
      <div className="space-y-6">
        <div>
          <h4 className="text-xs font-bold text-emerald-500 mb-3 uppercase">Discipline</h4>
          <div className="space-y-2">
            {disciplines.slice(0, 4).map(d => (
              <div key={d} className="flex items-center gap-2">
                 <div className="w-4 h-4 border border-zinc-700 bg-zinc-900 flex items-center justify-center cursor-pointer hover:border-emerald-500">
                    {/* Simulated checked state for demo */}
                 </div>
                 <span className="text-sm text-zinc-300 cursor-pointer hover:text-white">{d}</span>
              </div>
            ))}
          </div>
        </div>

        <div>
          <h4 className="text-xs font-bold text-emerald-500 mb-3 uppercase">Availability</h4>
          <div className="space-y-2">
            <div className="flex items-center gap-2">
              <div className="w-8 h-4 bg-emerald-900/30 border border-emerald-500/50 relative cursor-pointer">
                 <div className="absolute right-0 top-0 bottom-0 w-4 bg-emerald-500" />
              </div>
              <span className="text-sm text-zinc-300">Code Available</span>
            </div>
            <div className="flex items-center gap-2">
              <div className="w-8 h-4 bg-zinc-800 border border-zinc-700 relative cursor-pointer">
                 <div className="absolute left-0 top-0 bottom-0 w-4 bg-zinc-500" />
              </div>
              <span className="text-sm text-zinc-400">Data Available</span>
            </div>
          </div>
        </div>

        <div>
           <h4 className="text-xs font-bold text-emerald-500 mb-3 uppercase">Verification Level</h4>
           <div className="flex flex-col gap-1">
             {[0, 1, 2, 3].map(l => (
               <Button key={l} variant="ghost" size="sm" className="justify-start h-7 px-2 text-zinc-400 hover:text-white hover:bg-zinc-900">
                 Level {l}
               </Button>
             ))}
           </div>
        </div>
        
        <Button variant="outline" className="w-full text-xs h-8 border-dashed border-zinc-700 text-zinc-500 hover:text-white">
          Clear All Filters
        </Button>
      </div>

      <Separator />

      <div className="space-y-2">
        <h4 className="text-xs font-bold text-zinc-500 uppercase mb-2">Policy Quick Links</h4>
        <div className="flex flex-col gap-1 text-xs">
          <Link href="/policies" className="text-zinc-400 hover:text-emerald-500 transition-colors">Scope and Article Types</Link>
          <Link href="/policies" className="text-zinc-400 hover:text-emerald-500 transition-colors">AI Disclosure</Link>
          <Link href="/policies" className="text-zinc-400 hover:text-emerald-500 transition-colors">Ethical Standards</Link>
        </div>
      </div>
    </aside>
  );
}
