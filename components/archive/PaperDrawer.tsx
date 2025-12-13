"use client";

import React, { useEffect, useMemo, useState } from "react";
import { useRouter } from "next/navigation";
import type { Paper } from "@/lib/mockData";
import type { ClaimEvidence, EvidencePointer } from "@/lib/review/evidence";
import { 
  SheetContent, 
  Tabs, TabsList, TabsTrigger, TabsContent,
  Button, Badge, ScrollArea
} from "@/components/ui/shadcn";
import { EpistemicReviewPanel } from "@/components/review/EpistemicReviewPanel";
import { SteelmanDefensePanel } from "@/components/review/SteelmanDefensePanel";
import { VerificationWorkOrdersPanel } from "@/components/review/VerificationWorkOrdersPanel";
import { ExternalLink, ShieldCheck, GitBranch, Terminal, FileText, Copy } from "lucide-react";

interface PaperDrawerProps {
  paper: Paper | null;
}

export function PaperDrawer({ paper }: PaperDrawerProps) {
  const router = useRouter();
  const paperId = paper?.id || "";
  const [evidencePointers, setEvidencePointers] = useState<EvidencePointer[]>([]);
  const [claimEvidence, setClaimEvidence] = useState<ClaimEvidence[]>([]);
  const [cardBusy, setCardBusy] = useState(false);
  const [cardError, setCardError] = useState<string | null>(null);

  const sourceUrl = useMemo(() => {
    if (!paper) return null;
    if (paper.dataUrl) return paper.dataUrl;
    if (paper.doi && paper.doi.startsWith("10.")) return `https://doi.org/${paper.doi}`;
    return null;
  }, [paper]);

  useEffect(() => {
    if (!paperId) return;
    try {
      const raw = localStorage.getItem(`omega_evidence_v1:${paperId}`);
      if (!raw) {
        setEvidencePointers([]);
        setClaimEvidence([]);
        return;
      }
      const parsed = JSON.parse(raw) as Partial<{ version: number; evidencePointers: unknown; claimEvidence: unknown }>;
      if (parsed.version !== 1) return;
      setEvidencePointers(Array.isArray(parsed.evidencePointers) ? (parsed.evidencePointers as EvidencePointer[]) : []);
      setClaimEvidence(Array.isArray(parsed.claimEvidence) ? (parsed.claimEvidence as ClaimEvidence[]) : []);
    } catch {
      setEvidencePointers([]);
      setClaimEvidence([]);
    }
  }, [paperId]);

  const generateReviewCard = async () => {
    if (!paper || cardBusy) return;
    setCardBusy(true);
    setCardError(null);
    try {
      const res = await fetch("/api/review/engine", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          paper,
          evidencePointers,
          claimEvidence,
          engine: "auto",
          enqueueReproQueue: false,
        }),
        cache: "no-store",
      });
      const data = (await res.json().catch(() => ({}))) as { artifact?: { hash?: string }; error?: string };
      if (!res.ok) throw new Error(data?.error || `Engine error (${res.status})`);
      const hash = String(data?.artifact?.hash || "").replace(/^sha256:/, "");
      if (!hash) throw new Error("Engine did not return an artifact hash.");
      router.push(`/card/${encodeURIComponent(hash)}`);
    } catch (err) {
      setCardError(err instanceof Error ? err.message : "Failed to generate review card.");
    } finally {
      setCardBusy(false);
    }
  };

  if (!paper) return null;

  return (
    <SheetContent className="w-full sm:max-w-2xl lg:max-w-3xl border-l border-zinc-800 bg-zinc-950 p-0 flex flex-col h-full">
      {/* Header Area */}
      <div className="p-6 pb-2 border-b border-zinc-800">
        <div className="flex items-center gap-2 mb-4 text-xs font-mono text-emerald-500">
          <Terminal className="w-4 h-4" />
          <span>ARCHIVE_READ_ONLY_MODE</span>
        </div>
        <h2 className="text-2xl font-bold font-serif text-white mb-2">{paper.title}</h2>
        <div className="flex flex-wrap gap-4 text-sm text-zinc-400">
           <span>
             By {paper.authors.map(a => a.name).join(", ")}
           </span>
           <span className="text-zinc-600">|</span>
           <span className="font-mono">{paper.doi}</span>
        </div>
      </div>

      <ScrollArea className="flex-1">
        <div className="p-6 space-y-8">
          
          {/* Abstract */}
          <div className="prose prose-invert max-w-none">
            <p className="text-zinc-300 leading-relaxed text-sm">
              {paper.abstract}
            </p>
            <p className="text-xs text-zinc-500 mt-2 italic border-l-2 border-emerald-900 pl-2">
              Archive record. Community review may be ongoing.
            </p>
          </div>

          {/* Trust Layer Block */}
          <div className="border border-zinc-800 bg-zinc-900/20 p-4 space-y-4">
             <div className="flex items-center gap-2 text-sm font-semibold text-emerald-400 uppercase tracking-widest mb-2">
               <ShieldCheck className="w-4 h-4" /> Trust Layer
             </div>
             
             <div className="grid grid-cols-1 md:grid-cols-2 gap-6 text-sm">
                <div>
                   <span className="block text-zinc-500 text-xs mb-1">Source</span>
                   <div className="flex items-center gap-2 text-zinc-300">
                      <Badge variant="outline" className="font-mono text-xs">{paper.importedFrom}</Badge>
                      {sourceUrl ? (
                        <a href={sourceUrl} target="_blank" rel="noreferrer">
                          <ExternalLink className="w-3 h-3 text-zinc-600 hover:text-white" />
                        </a>
                      ) : (
                        <ExternalLink className="w-3 h-3 text-zinc-600" />
                      )}
                   </div>
                </div>
                <div>
                   <span className="block text-zinc-500 text-xs mb-1">Falsifiability Path</span>
                   <p className="text-zinc-300 text-xs font-mono border-l border-zinc-700 pl-2">
                     {paper.falsifiabilityPath}
                   </p>
                </div>
             </div>

             {/* Bounty Status */}
             <div className="bg-zinc-950 border border-zinc-800 p-3 flex justify-between items-center">
                <div className="flex flex-col">
                  <span className="text-xs text-zinc-500 uppercase">Replication Status</span>
                  {paper.replicationBounty?.active ? (
                    <span className="text-indigo-400 font-bold flex items-center gap-2">
                       Active Bounty: {paper.replicationBounty.amountELF} ELF
                    </span>
                  ) : (
                    <span className="text-zinc-400">No active bounty</span>
                  )}
                </div>
                <div className="flex items-center gap-2">
                  <a href={`/conclusion?paper=${encodeURIComponent(paper.id)}`}>
                    <Button size="sm" variant="outline" className="border-zinc-700 text-zinc-300 hover:border-emerald-500 hover:text-emerald-500">
                      Conclusion
                    </Button>
                  </a>
                  <Button
                    size="sm"
                    variant="outline"
                    className="border-zinc-700 text-zinc-300 hover:border-emerald-500 hover:text-emerald-500"
                    onClick={() => void generateReviewCard()}
                    disabled={cardBusy}
                  >
                    {cardBusy ? "Generating..." : "Review Card"}
                  </Button>
                  {paper.replicationBounty?.active && (
                     <Button size="sm" variant="outline" className="border-indigo-500 text-indigo-500 hover:bg-indigo-950">
                       Start Replication
                     </Button>
                  )}
                </div>
             </div>
             {cardError ? (
               <div className="mt-3 border border-red-900/40 bg-red-950/20 p-3 text-sm text-red-300">
                 {cardError}
               </div>
             ) : null}
          </div>

          <Tabs defaultValue="overview" className="w-full">
            <TabsList className="w-full justify-start bg-transparent border-b border-zinc-800 rounded-none p-0 h-auto">
              <TabsTrigger value="overview" className="rounded-none border-b-2 border-transparent data-[state=active]:border-emerald-500 data-[state=active]:bg-transparent pb-3 pt-2">Overview</TabsTrigger>
              <TabsTrigger value="epistemic" className="rounded-none border-b-2 border-transparent data-[state=active]:border-emerald-500 data-[state=active]:bg-transparent pb-3 pt-2">Epistemic</TabsTrigger>
              <TabsTrigger value="defense" className="rounded-none border-b-2 border-transparent data-[state=active]:border-emerald-500 data-[state=active]:bg-transparent pb-3 pt-2">Defense</TabsTrigger>
              <TabsTrigger value="verify" className="rounded-none border-b-2 border-transparent data-[state=active]:border-emerald-500 data-[state=active]:bg-transparent pb-3 pt-2">Verify</TabsTrigger>
              <TabsTrigger value="versions" className="rounded-none border-b-2 border-transparent data-[state=active]:border-emerald-500 data-[state=active]:bg-transparent pb-3 pt-2">History</TabsTrigger>
              <TabsTrigger value="reviews" className="rounded-none border-b-2 border-transparent data-[state=active]:border-emerald-500 data-[state=active]:bg-transparent pb-3 pt-2">
                Open Reviews <Badge className="ml-2 h-4 px-1 text-[10px]" variant="secondary">{paper.openReviewsCount}</Badge>
              </TabsTrigger>
              <TabsTrigger value="files" className="rounded-none border-b-2 border-transparent data-[state=active]:border-emerald-500 data-[state=active]:bg-transparent pb-3 pt-2">Files & Code</TabsTrigger>
            </TabsList>

            <TabsContent value="overview" className="pt-6 space-y-6">
               <div>
                 <h4 className="text-sm font-semibold text-zinc-400 mb-3">CRediT Contribution (Simulated)</h4>
                 <div className="border border-zinc-800">
                    <div className="grid grid-cols-3 bg-zinc-900/50 p-2 text-xs font-mono text-zinc-500 border-b border-zinc-800">
                       <div>ROLE</div>
                       <div>HUMAN</div>
                       <div>AI</div>
                    </div>
                    {[
                      { role: "Conceptualization", human: "High", ai: "Low" },
                      { role: "Methodology", human: "Med", ai: "Med" },
                      { role: "Software", human: "Low", ai: "High" },
                      { role: "Writing", human: "Med", ai: "High" }
                    ].map((row, i) => (
                      <div key={i} className="grid grid-cols-3 p-2 text-xs text-zinc-300 border-b border-zinc-800/50 last:border-0">
                         <div className="font-semibold text-zinc-400">{row.role}</div>
                         <div>{row.human}</div>
                         <div className="text-amber-500">{row.ai}</div>
                      </div>
                    ))}
                 </div>
               </div>
             </TabsContent>

             <TabsContent value="epistemic" className="pt-6">
               <EpistemicReviewPanel paper={paper} evidencePointers={evidencePointers} claimEvidence={claimEvidence} />
             </TabsContent>

             <TabsContent value="defense" className="pt-6">
               <SteelmanDefensePanel paper={paper} evidencePointers={evidencePointers} />
             </TabsContent>

             <TabsContent value="verify" className="pt-6">
               <VerificationWorkOrdersPanel paper={paper} evidencePointers={evidencePointers} claimEvidence={claimEvidence} />
             </TabsContent>

             <TabsContent value="versions" className="pt-6">
               <div className="relative border-l border-zinc-800 ml-3 space-y-6 pb-2">
                 {paper.versions.map((v, i) => (
                   <div key={i} className="pl-6 relative">
                    <div className="absolute -left-[5px] top-1 w-2.5 h-2.5 bg-zinc-950 border border-emerald-500 rounded-none transform rotate-45" />
                    <div className="flex justify-between items-start">
                      <div>
                        <span className="text-sm font-bold text-emerald-400 block">{v.version}</span>
                        <span className="text-xs text-zinc-500 font-mono">{v.date}</span>
                      </div>
                      <Button size="sm" variant="ghost" className="h-6 text-xs">View</Button>
                    </div>
                    <p className="text-sm text-zinc-300 mt-1">{v.note}</p>
                  </div>
                ))}
              </div>
            </TabsContent>

            <TabsContent value="reviews" className="pt-6 space-y-6">
               {/* Mock Composer */}
               <div className="bg-zinc-900/30 border border-zinc-800 p-4">
                  <h4 className="text-sm font-semibold text-zinc-300 mb-2">Post a Review</h4>
                  <textarea className="w-full bg-black border border-zinc-800 p-2 text-sm text-zinc-200 min-h-[80px] focus:outline-none focus:border-emerald-500" placeholder="Critique methodology, reproducibility, or clarity..." />
                  <div className="flex justify-between items-center mt-3">
                     <div className="flex items-center gap-2">
                       <input type="checkbox" className="accent-emerald-500" id="verified" />
                       <label htmlFor="verified" className="text-xs text-zinc-500 cursor-pointer">Sign as Verified Scientist</label>
                     </div>
                     <Button size="sm" variant="emerald">Post Review</Button>
                  </div>
               </div>

               {/* Mock Reviews */}
               {paper.reviews.length > 0 ? paper.reviews.map((review) => (
                 <div key={review.id} className="border border-zinc-800 bg-zinc-950 p-4">
                    <div className="flex justify-between items-center mb-3">
                       <div className="flex items-center gap-2">
                          <span className="font-bold text-zinc-200 text-sm">{review.author}</span>
                          {review.verified && <ShieldCheck className="w-3 h-3 text-emerald-500" />}
                       </div>
                       <span className="text-xs text-zinc-600 font-mono">{review.createdAt}</span>
                    </div>
                    <div className="grid grid-cols-1 md:grid-cols-2 gap-4 mb-3">
                      <div className="bg-emerald-950/10 border-l-2 border-emerald-900 p-2">
                        <span className="text-xs font-bold text-emerald-700 block mb-1">STRENGTHS</span>
                        <ul className="list-disc list-inside text-xs text-zinc-400">
                          {review.strengths.map((s, idx) => <li key={idx}>{s}</li>)}
                        </ul>
                      </div>
                      <div className="bg-red-950/10 border-l-2 border-red-900 p-2">
                        <span className="text-xs font-bold text-red-700 block mb-1">CONCERNS</span>
                        <ul className="list-disc list-inside text-xs text-zinc-400">
                          {review.concerns.map((s, idx) => <li key={idx}>{s}</li>)}
                        </ul>
                      </div>
                    </div>
                    <Button variant="ghost" size="sm" className="h-6 text-[10px] text-zinc-500 hover:text-white">
                      Cite this review
                    </Button>
                 </div>
               )) : (
                 <div className="text-center py-8 text-zinc-600 italic">No reviews yet. Be the first.</div>
               )}
            </TabsContent>

            <TabsContent value="files" className="pt-6 space-y-4">
              <div className="border border-zinc-800 divide-y divide-zinc-800">
                 <div className="p-3 flex items-center justify-between">
                    <div className="flex items-center gap-3">
                       <FileText className="w-4 h-4 text-zinc-400" />
                       <span className="text-sm font-mono">manuscript_v1.2.pdf</span>
                    </div>
                    <Button variant="outline" size="sm" className="h-7 text-xs">Download</Button>
                 </div>
                 {paper.codeAvailable && (
                   <div className="p-3 flex flex-col gap-2">
                      <div className="flex items-center justify-between">
                        <div className="flex items-center gap-3">
                           <GitBranch className="w-4 h-4 text-emerald-500" />
                           <span className="text-sm font-mono text-emerald-400">Source Code Repository</span>
                        </div>
                        <a href={paper.codeUrl} target="_blank" rel="noreferrer">
                          <Button variant="outline" size="sm" className="h-7 text-xs">Visit Repo</Button>
                        </a>
                      </div>
                      <div className="bg-zinc-950 p-2 font-mono text-xs text-zinc-500 flex justify-between items-center">
                         {paper.codeHash}
                         <Copy className="w-3 h-3 cursor-pointer hover:text-white" />
                      </div>
                   </div>
                 )}
              </div>
            </TabsContent>
          </Tabs>
        </div>
      </ScrollArea>
    </SheetContent>
  );
}
