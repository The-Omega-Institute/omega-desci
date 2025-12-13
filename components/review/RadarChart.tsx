import React from "react";
import { cn } from "@/lib/utils";

export type RadarDatum = {
  id: string;
  label: string;
  value: number; // 0..1
};

function clamp01(n: number) {
  return Math.max(0, Math.min(1, n));
}

function polarToCartesian(cx: number, cy: number, r: number, angleRad: number) {
  return { x: cx + r * Math.cos(angleRad), y: cy + r * Math.sin(angleRad) };
}

function polygonPoints(cx: number, cy: number, radius: number, values: number[]) {
  const n = values.length;
  const points = values.map((v, i) => {
    const angle = (Math.PI * 2 * i) / n - Math.PI / 2;
    const r = radius * clamp01(v);
    const p = polarToCartesian(cx, cy, r, angle);
    return `${p.x.toFixed(2)},${p.y.toFixed(2)}`;
  });
  return points.join(" ");
}

export function RadarChart({
  data,
  size = 280,
  className,
}: {
  data: RadarDatum[];
  size?: number;
  className?: string;
}) {
  const n = data.length;
  const cx = size / 2;
  const cy = size / 2;
  const radius = size * 0.36;
  const rings = 4;

  const axisAngles = data.map((_, i) => (Math.PI * 2 * i) / n - Math.PI / 2);
  const gridPolys = Array.from({ length: rings }, (_, k) => (k + 1) / rings);
  const valuePoly = polygonPoints(cx, cy, radius, data.map((d) => d.value));

  return (
    <div className={cn("w-full", className)}>
      <svg width={size} height={size} viewBox={`0 0 ${size} ${size}`} className="block mx-auto">
        {/* rings */}
        {gridPolys.map((frac) => {
          const pts = polygonPoints(cx, cy, radius, Array.from({ length: n }, () => frac));
          return <polygon key={frac} points={pts} fill="none" stroke="#27272a" strokeWidth="1" />;
        })}

        {/* axes */}
        {axisAngles.map((angle, i) => {
          const p = polarToCartesian(cx, cy, radius, angle);
          return <line key={i} x1={cx} y1={cy} x2={p.x} y2={p.y} stroke="#27272a" strokeWidth="1" />;
        })}

        {/* value polygon */}
        <polygon points={valuePoly} fill="rgba(16, 185, 129, 0.18)" stroke="#10b981" strokeWidth="1.5" />

        {/* center dot */}
        <circle cx={cx} cy={cy} r="2" fill="#10b981" />
      </svg>

      <div className="mt-3 grid grid-cols-3 gap-2">
        {data.map((d) => (
          <div key={d.id} className="border border-zinc-800 bg-zinc-950 p-2">
            <div className="text-[10px] font-mono text-zinc-500">{d.label.toUpperCase()}</div>
            <div className="text-sm font-mono text-emerald-500">{Math.round(clamp01(d.value) * 100)}/100</div>
          </div>
        ))}
      </div>
    </div>
  );
}

