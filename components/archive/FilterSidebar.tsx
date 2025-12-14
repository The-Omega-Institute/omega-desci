"use client";

import Link from "next/link";
import { Check } from "lucide-react";
import type { Paper, VerificationLevel } from "@/lib/mockData";
import { DEFAULT_ARCHIVE_FILTERS, type ArchiveFilters, toggleStringArrayValue } from "@/lib/archive/filters";
import { cn } from "@/lib/utils";
import { Badge, Button, Separator } from "@/components/ui/shadcn";

const DISCIPLINES: Paper["discipline"][] = [
  "Digital Physics",
  "Cellular Automata",
  "Thermodynamics",
  "AI Foundations",
  "Cosmology",
];

const ARTICLE_TYPES: Paper["articleType"][] = [
  "Theory Preprint",
  "Conjecture Note",
  "Proof or Formal Derivation",
  "Computational Experiment",
  "Verification Report",
  "Replication Report",
  "Negative Result",
  "Survey or Synthesis",
  "Critique or Commentary",
];

const VERIFICATION_LEVELS: VerificationLevel[] = [0, 1, 2, 3];

type FilterSidebarProps = {
  value: ArchiveFilters;
  onChange: (next: ArchiveFilters) => void;
  onClear?: () => void;
  className?: string;
};

export function FilterSidebar({ value, onChange, onClear, className }: FilterSidebarProps) {
  const clear = onClear || (() => onChange(DEFAULT_ARCHIVE_FILTERS));

  return (
    <aside className={cn("space-y-8 pr-4", className)}>
      {/* Scope Summary */}
      <div className="space-y-4">
        <h3 className="text-sm font-bold text-zinc-100 uppercase tracking-widest border-b border-zinc-800 pb-2">Scope Summary</h3>
        <p className="text-xs text-zinc-400 leading-relaxed italic">
          &ldquo;Omega publishes high-variance, falsifiable research. Claims must include assumptions and a test path.&rdquo;
        </p>
        <div className="flex flex-wrap gap-2">
          {DISCIPLINES.map((d) => (
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
            {DISCIPLINES.map((d) => {
              const checked = value.disciplines.includes(d);
              return (
                <button
                  key={d}
                  type="button"
                  className="flex items-center gap-2 group text-left"
                  onClick={() =>
                    onChange({
                      ...value,
                      disciplines: toggleStringArrayValue(value.disciplines, d),
                    })
                  }
                >
                  <div
                    className={cn(
                      "w-4 h-4 border bg-zinc-900 flex items-center justify-center",
                      checked ? "border-emerald-500 bg-emerald-950/30" : "border-zinc-700 group-hover:border-emerald-500"
                    )}
                    aria-hidden="true"
                  >
                    {checked ? <Check className="w-3 h-3 text-emerald-500" /> : null}
                  </div>
                  <span className={cn("text-sm cursor-pointer", checked ? "text-white" : "text-zinc-300 group-hover:text-white")}>{d}</span>
                </button>
              );
            })}
          </div>
        </div>

        <div>
          <h4 className="text-xs font-bold text-emerald-500 mb-3 uppercase">Article Type</h4>
          <div className="space-y-2">
            {ARTICLE_TYPES.map((t) => {
              const checked = value.articleTypes.includes(t);
              return (
                <button
                  key={t}
                  type="button"
                  className="flex items-center gap-2 group text-left"
                  onClick={() =>
                    onChange({
                      ...value,
                      articleTypes: toggleStringArrayValue(value.articleTypes, t),
                    })
                  }
                >
                  <div
                    className={cn(
                      "w-4 h-4 border bg-zinc-900 flex items-center justify-center",
                      checked ? "border-emerald-500 bg-emerald-950/30" : "border-zinc-700 group-hover:border-emerald-500"
                    )}
                    aria-hidden="true"
                  >
                    {checked ? <Check className="w-3 h-3 text-emerald-500" /> : null}
                  </div>
                  <span className={cn("text-sm cursor-pointer", checked ? "text-white" : "text-zinc-300 group-hover:text-white")}>{t}</span>
                </button>
              );
            })}
          </div>
        </div>

        <div>
          <h4 className="text-xs font-bold text-emerald-500 mb-3 uppercase">Availability</h4>
          <div className="space-y-2">
            <div className="flex items-center gap-2">
              <button
                type="button"
                role="switch"
                aria-checked={value.requireCode}
                className={cn(
                  "w-8 h-4 border relative cursor-pointer",
                  value.requireCode ? "bg-emerald-900/30 border-emerald-500/50" : "bg-zinc-800 border-zinc-700"
                )}
                onClick={() => onChange({ ...value, requireCode: !value.requireCode })}
              >
                <div
                  className={cn(
                    "absolute top-0 bottom-0 w-4 transition-all",
                    value.requireCode ? "right-0 bg-emerald-500" : "left-0 bg-zinc-500"
                  )}
                />
              </button>
              <span className="text-sm text-zinc-300">Code Available</span>
            </div>
            <div className="flex items-center gap-2">
              <button
                type="button"
                role="switch"
                aria-checked={value.requireData}
                className={cn(
                  "w-8 h-4 border relative cursor-pointer",
                  value.requireData ? "bg-emerald-900/30 border-emerald-500/50" : "bg-zinc-800 border-zinc-700"
                )}
                onClick={() => onChange({ ...value, requireData: !value.requireData })}
              >
                <div
                  className={cn(
                    "absolute top-0 bottom-0 w-4 transition-all",
                    value.requireData ? "right-0 bg-emerald-500" : "left-0 bg-zinc-500"
                  )}
                />
              </button>
              <span className={cn("text-sm", value.requireData ? "text-zinc-300" : "text-zinc-400")}>Data Available</span>
            </div>
          </div>
        </div>

        <div>
           <h4 className="text-xs font-bold text-emerald-500 mb-3 uppercase">Verification Level</h4>
           <div className="flex flex-col gap-1">
             {VERIFICATION_LEVELS.map((l) => {
               const active = value.minLevel === l;
               return (
                 <Button
                   key={l}
                   type="button"
                   variant="ghost"
                   size="sm"
                   className={cn(
                     "justify-start h-7 px-2",
                     active ? "text-emerald-400 bg-emerald-500/10 hover:bg-emerald-500/15" : "text-zinc-400 hover:text-white hover:bg-zinc-900"
                   )}
                   onClick={() => onChange({ ...value, minLevel: active ? null : l })}
                 >
                   Level {l}+
                 </Button>
               );
             })}
           </div>
        </div>
        
        <Button
          type="button"
          variant="outline"
          className="w-full text-xs h-8 border-dashed border-zinc-700 text-zinc-500 hover:text-white"
          onClick={clear}
        >
          Clear All Filters
        </Button>
      </div>

      <Separator />

      <div className="space-y-2">
         <h4 className="text-xs font-bold text-zinc-500 uppercase mb-2">Policy Quick Links</h4>
         <div className="flex flex-col gap-1 text-xs">
           <Link href="/policies" className="text-zinc-400 hover:text-emerald-500 transition-colors">Scope and Article Types</Link>
           <Link href="/policies" className="text-zinc-400 hover:text-emerald-500 transition-colors">Provenance & Tooling</Link>
           <Link href="/policies" className="text-zinc-400 hover:text-emerald-500 transition-colors">Ethical Standards</Link>
         </div>
       </div>
     </aside>
   );
 }
