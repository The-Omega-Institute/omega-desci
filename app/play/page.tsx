"use client";

import React, { useMemo, useState } from "react";
import Link from "next/link";
import { Badge, Button, Card, CardContent, CardHeader, CardTitle, Input, Separator } from "@/components/ui/shadcn";
import { PLAYBOOK_NEXT, PLAYBOOK_NOW, type PlaybookArea, type PlaybookItem } from "@/lib/playbook";
import { BookOpen, Gavel, LayoutGrid, Network, Sparkles, User } from "lucide-react";
import { cn } from "@/lib/utils";

const AREA_ICON: Record<PlaybookArea, React.ComponentType<{ className?: string }>> = {
  Explore: Network,
  Review: Sparkles,
  Verify: Gavel,
  Govern: BookOpen,
  Identity: User,
};

function matchesQuery(item: PlaybookItem, q: string) {
  const query = q.trim().toLowerCase();
  if (!query) return true;
  const hay = [
    item.id,
    item.area,
    item.status,
    item.runtime,
    item.href || "",
    item.titleEn,
    item.titleZh,
    item.summaryEn,
    item.summaryZh,
    item.notesEn || "",
    item.notesZh || "",
    ...(item.tags || []),
  ]
    .join(" ")
    .toLowerCase();
  return hay.includes(query);
}

function statusBadgeVariant(status: PlaybookItem["status"]) {
  if (status === "live") return "emerald";
  if (status === "demo") return "amber";
  return "muted";
}

function runtimeBadgeVariant(runtime: PlaybookItem["runtime"]) {
  return runtime === "both" ? "muted" : "amber";
}

function runtimeLabel(runtime: PlaybookItem["runtime"]) {
  return runtime === "both" ? "PAGES_OK" : "NEXT_ONLY";
}

function areaLabel(area: PlaybookArea) {
  if (area === "Explore") return "EXPLORE / 探索";
  if (area === "Review") return "REVIEW / 评审";
  if (area === "Verify") return "VERIFY / 验证";
  if (area === "Govern") return "GOVERN / 治理";
  return "IDENTITY / 身份";
}

function ItemCard({ item }: { item: PlaybookItem }) {
  const Icon = AREA_ICON[item.area];
  return (
    <Card className="h-full">
      <CardHeader className="space-y-3">
        <div className="flex items-start justify-between gap-3">
          <div className="space-y-2">
            <div className="flex items-center gap-2">
              <Icon className="h-4 w-4 text-emerald-500" />
              <div className="text-[10px] font-mono text-zinc-600">{areaLabel(item.area)}</div>
            </div>
            <CardTitle className="text-zinc-100 leading-tight">{item.titleEn}</CardTitle>
            <div className="text-sm text-zinc-500 leading-snug">{item.titleZh}</div>
          </div>

          <div className="flex flex-col items-end gap-2">
            <Badge variant={statusBadgeVariant(item.status)} className="font-mono text-[10px]">
              {item.status.toUpperCase()}
            </Badge>
            <Badge variant={runtimeBadgeVariant(item.runtime)} className="font-mono text-[10px]">
              {runtimeLabel(item.runtime)}
            </Badge>
          </div>
        </div>
      </CardHeader>
      <CardContent className="space-y-3">
        <div className="space-y-2">
          <p className="text-sm text-zinc-300">{item.summaryEn}</p>
          <p className="text-sm text-zinc-500">{item.summaryZh}</p>
          {item.notesEn || item.notesZh ? (
            <div className="border border-zinc-800 bg-black/20 p-3 space-y-1">
              {item.notesEn ? <div className="text-xs text-zinc-400">{item.notesEn}</div> : null}
              {item.notesZh ? <div className="text-xs text-zinc-600">{item.notesZh}</div> : null}
            </div>
          ) : null}
        </div>

        {item.tags?.length ? (
          <div className="flex flex-wrap gap-2">
            {item.tags.slice(0, 8).map((t) => (
              <Badge key={t} variant="muted" className="font-mono text-[10px]">
                {t}
              </Badge>
            ))}
          </div>
        ) : null}

        {item.href ? (
          <div className="pt-2">
            <Link href={item.href}>
              <Button
                variant={item.status === "planned" ? "outline" : "emerald"}
                size="sm"
                className={cn(item.status === "planned" ? "border-zinc-700 text-zinc-300 hover:border-emerald-500 hover:text-emerald-500" : "")}
              >
                OPEN
              </Button>
            </Link>
          </div>
        ) : null}
      </CardContent>
    </Card>
  );
}

export default function PlaybookPage() {
  const [q, setQ] = useState("");

  const now = useMemo(() => PLAYBOOK_NOW.filter((i) => matchesQuery(i, q)), [q]);
  const next = useMemo(
    () =>
      PLAYBOOK_NEXT.map((stage) => ({
        ...stage,
        items: stage.items.filter((i) => matchesQuery(i, q)),
      })).filter((s) => s.items.length),
    [q]
  );

  return (
    <div className="container py-10">
      <div className="max-w-5xl mx-auto space-y-6">
        <div className="flex flex-wrap items-start justify-between gap-4">
          <div className="space-y-2">
            <div className="text-[10px] font-mono text-zinc-600 flex items-center gap-2">
              <LayoutGrid className="h-4 w-4 text-emerald-500" />
              PLAYBOOK / 玩法总览
            </div>
            <h1 className="text-2xl md:text-3xl font-serif text-zinc-100">Everything we can play today â€” and what weâ€™ll ship next</h1>
            <p className="text-sm text-zinc-500">
              EN: This page consolidates all current interactive modules in the demo UI, plus the staged roadmap.
              <br />
              中文：这里把当前 Demo 里所有可交互玩法汇总，并列出分阶段路线图。
            </p>
          </div>

          <div className="flex flex-col items-end gap-2">
            <Badge variant="muted" className="font-mono text-[10px]">
              PAGES_OK = works on GitHub Pages
            </Badge>
            <Badge variant="amber" className="font-mono text-[10px]">
              NEXT_ONLY = requires Next.js server runtime
            </Badge>
          </div>
        </div>

        <div className="flex flex-col md:flex-row md:items-center gap-3 border border-zinc-800 bg-zinc-950/40 p-4">
          <div className="text-xs font-mono text-zinc-600 md:w-44">SEARCH</div>
          <Input value={q} onChange={(e) => setQ(e.target.value)} placeholder="Try: map / zenodo / claims / bounty / audit / protocol ..." className="font-mono" />
        </div>

        <Separator className="bg-zinc-800" />

        <section className="space-y-3">
          <div className="flex items-end justify-between gap-4">
            <div className="space-y-1">
              <div className="text-xs font-mono text-emerald-500">NOW / 现在能玩什么</div>
              <div className="text-sm text-zinc-500">Routes and modules that exist in the current demo.</div>
            </div>
            <Badge variant="muted" className="font-mono text-[10px]">
              {now.length} MODULES
            </Badge>
          </div>
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            {now.map((item) => (
              <ItemCard key={item.id} item={item} />
            ))}
          </div>
        </section>

        <Separator className="bg-zinc-800" />

        <section className="space-y-6">
          <div className="space-y-1">
            <div className="text-xs font-mono text-emerald-500">NEXT / 路线图</div>
            <div className="text-sm text-zinc-500">What we plan to build, staged to keep the academic credibility layer intact.</div>
          </div>

          {next.length ? (
            <div className="space-y-8">
              {next.map((stage) => (
                <div key={stage.stageId} className="space-y-3">
                  <div className="flex flex-wrap items-end justify-between gap-3">
                    <div className="space-y-1">
                      <div className="text-[10px] font-mono text-zinc-600">{`STAGE_${stage.stageId}`}</div>
                      <div className="text-lg font-serif text-zinc-100">{stage.titleEn}</div>
                      <div className="text-sm text-zinc-500">{stage.titleZh}</div>
                    </div>
                    <Badge variant="muted" className="font-mono text-[10px]">
                      {stage.items.length} ITEMS
                    </Badge>
                  </div>

                  <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                    {stage.items.map((item) => (
                      <ItemCard key={item.id} item={item} />
                    ))}
                  </div>
                </div>
              ))}
            </div>
          ) : (
            <div className="text-sm text-zinc-600 italic border border-zinc-800 bg-black/20 p-4">No roadmap items match the search query.</div>
          )}
        </section>
      </div>
    </div>
  );
}

