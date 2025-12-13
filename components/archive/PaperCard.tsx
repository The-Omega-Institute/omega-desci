import React, { useEffect, useState } from "react";
import Link from "next/link";
import { Paper } from "@/lib/mockData";
import { Badge, Card, CardContent, CardFooter, CardHeader, Button } from "@/components/ui/shadcn";
import { Bot, Github, Database, Eye, Check, Copy } from "lucide-react";
import { Tooltip, TooltipContent, TooltipProvider, TooltipTrigger } from "@/components/ui/shadcn";

interface PaperCardProps {
  paper: Paper;
  onClick: (id: string) => void;
}

export function PaperCard({ paper, onClick }: PaperCardProps) {
  const [copied, setCopied] = useState(false);

  useEffect(() => {
    if (!copied) return;
    const t = window.setTimeout(() => setCopied(false), 1200);
    return () => window.clearTimeout(t);
  }, [copied]);

  const copyHash = async (event: React.MouseEvent) => {
    event.preventDefault();
    event.stopPropagation();
    if (!paper.codeHash) return;

    try {
      await navigator.clipboard.writeText(paper.codeHash);
      setCopied(true);
    } catch {
      try {
        const el = document.createElement("textarea");
        el.value = paper.codeHash;
        el.setAttribute("readonly", "true");
        el.style.position = "fixed";
        el.style.left = "-9999px";
        document.body.appendChild(el);
        el.select();
        document.execCommand("copy");
        document.body.removeChild(el);
        setCopied(true);
      } catch {
        setCopied(false);
      }
    }
  };

  return (
    <Card 
      className="group flex flex-col justify-between hover:border-emerald-500/50 transition-colors cursor-pointer h-full"
      onClick={() => onClick(paper.id)}
    >
      <CardHeader className="pb-3">
        <div className="flex justify-between items-start text-xs font-mono mb-2 text-zinc-500">
          <span className="uppercase tracking-wider text-indigo-400">{paper.collectionVolume}</span>
          <div className="flex items-center gap-2">
            {paper.level > 0 && (
              <Badge variant="outline" className="border-emerald-900 bg-emerald-950/30 text-emerald-500 gap-1">
                <Check className="w-3 h-3" />
                Level {paper.level}
              </Badge>
            )}
            {paper.level === 0 && <Badge variant="muted">Draft</Badge>}
          </div>
        </div>
        
        <h3 className="text-xl font-bold text-zinc-100 leading-tight group-hover:text-emerald-400 transition-colors">
          {paper.title}
        </h3>

        <div className="flex flex-wrap gap-2 pt-2 text-sm text-zinc-400">
          {paper.authors.map((author, idx) => (
            <span key={idx} className={author.isAI ? "text-amber-500 flex items-center gap-1" : ""}>
               {author.name}{author.isAI && <Bot className="w-3 h-3" />}
               {idx < paper.authors.length - 1 && ","}
            </span>
          ))}
        </div>
      </CardHeader>

      <CardContent className="space-y-4">
        <div className="flex flex-wrap gap-2">
          <Badge variant="outline" className="bg-zinc-900 text-zinc-300 border-zinc-700">
            {paper.discipline}
          </Badge>
          {paper.keywords.slice(0, 3).map((kw, i) => (
            <Link key={i} href={`/map?keyword=${encodeURIComponent(kw)}`} onClick={(e) => e.stopPropagation()}>
              <Badge variant="secondary" className="bg-zinc-900 text-zinc-500 hover:text-emerald-400 cursor-pointer">
                {kw}
              </Badge>
            </Link>
          ))}
          {paper.keywords.length > 3 && (
             <Link href={`/map?q=${encodeURIComponent(paper.title)}`} onClick={(e) => e.stopPropagation()}>
               <Badge variant="secondary" className="bg-zinc-900 text-zinc-500 hover:text-emerald-400 cursor-pointer">
                 +{paper.keywords.length - 3}
               </Badge>
             </Link>
          )}
        </div>

        <div className="flex flex-wrap gap-3 pt-2">
          {paper.aiContributionPercent > 0 && (
             <TooltipProvider>
               <Tooltip>
                 <TooltipTrigger>
                    <Badge variant="amber" className="gap-1.5 cursor-help">
                      <Bot className="w-3 h-3" /> AI: {paper.aiContributionPercent}%
                    </Badge>
                 </TooltipTrigger>
                 <TooltipContent>AI Author Contribution</TooltipContent>
               </Tooltip>
             </TooltipProvider>
          )}

          <Badge variant={paper.codeAvailable ? "emerald" : "muted"} className="gap-1.5">
            <Github className="w-3 h-3" /> {paper.codeAvailable ? "Code" : "No Code"}
          </Badge>

          <Badge variant={paper.dataAvailable ? "emerald" : "muted"} className="gap-1.5">
            <Database className="w-3 h-3" /> {paper.dataAvailable ? "Data" : "No Data"}
          </Badge>

          <Badge variant="outline" className="gap-1.5 border-zinc-700 text-zinc-400">
            <Eye className="w-3 h-3" /> {paper.openReviewsCount}
          </Badge>

          {paper.replicationBounty?.active && (
            <Badge className="bg-indigo-600 hover:bg-indigo-500 text-white border-0 gap-1 ml-auto">
              {paper.replicationBounty.amountELF} ELF
            </Badge>
          )}
        </div>
      </CardContent>

      <CardFooter className="flex flex-col items-start gap-2 border-t border-zinc-900 bg-zinc-950/30 py-3 mt-auto">
        <div className="w-full flex justify-between items-center text-xs font-mono text-zinc-600">
           <span>DOI: {paper.doi}</span>
        </div>
        {paper.codeHash && (
           <div className="w-full flex justify-between items-center text-xs font-mono text-zinc-600 group/hash">
             <span>Hash: {paper.codeHash}</span>
             <TooltipProvider>
               <Tooltip>
                 <TooltipTrigger asChild>
                   <Button
                     type="button"
                     variant="ghost"
                     size="icon"
                     className="h-4 w-4 text-zinc-700 opacity-0 group-hover/hash:opacity-100 hover:text-emerald-500"
                     onClick={copyHash}
                     aria-label="Copy code hash"
                   >
                     <Copy className="h-3 w-3" />
                   </Button>
                 </TooltipTrigger>
                 <TooltipContent>{copied ? "Copied" : "Copy hash"}</TooltipContent>
               </Tooltip>
             </TooltipProvider>
           </div>
        )}
      </CardFooter>
    </Card>
  );
}
