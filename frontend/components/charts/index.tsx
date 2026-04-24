"use client";
import { useState } from "react";
import { fmtUSD, fmtDate, fmtNum } from "@/lib/utils";

const PROVIDER_COLORS: Record<string, string> = {
  violet: "oklch(0.55 0.19 290)",
  teal:   "oklch(0.60 0.12 195)",
  amber:  "oklch(0.72 0.15 70)",
  zinc:   "oklch(0.55 0.01 260)",
  sky:    "oklch(0.60 0.14 230)",
  rose:   "oklch(0.60 0.18 15)",
};
export function providerColor(color: string) {
  return PROVIDER_COLORS[color] || PROVIDER_COLORS.zinc;
}

// Area Chart
interface AreaChartProps {
  data: Array<{ date: string; [key: string]: number | string }>;
  xKey: string;
  yKey: string;
  color?: string;
  valueFormatter?: (v: number) => string;
  height?: number;
}

export function AreaChart({ data, xKey, yKey, color = "oklch(0.55 0.19 290)", valueFormatter = fmtUSD, height = 220 }: AreaChartProps) {
  const [hover, setHover] = useState<number | null>(null);
  const pad = { l: 52, r: 12, t: 12, b: 26 };
  const w = 680, h = height;
  const iw = w - pad.l - pad.r;
  const ih = h - pad.t - pad.b;
  const vals = data.map((d) => Number(d[yKey]));
  const max = Math.max(...vals) || 1;
  const xs = data.map((_, i) => pad.l + (i / (data.length - 1 || 1)) * iw);
  const ys = data.map((d) => pad.t + ih - (Number(d[yKey]) / max) * ih);
  const pathLine = xs.map((x, i) => `${i === 0 ? "M" : "L"} ${x.toFixed(2)} ${ys[i].toFixed(2)}`).join(" ");
  const pathArea = `${pathLine} L ${xs[xs.length - 1]} ${pad.t + ih} L ${xs[0]} ${pad.t + ih} Z`;
  const ticks = [0, 0.25, 0.5, 0.75, 1];

  const onMove = (e: React.MouseEvent<SVGSVGElement>) => {
    const rect = e.currentTarget.getBoundingClientRect();
    const relX = ((e.clientX - rect.left) / rect.width) * w;
    let idx = Math.round(((relX - pad.l) / iw) * (data.length - 1));
    idx = Math.max(0, Math.min(data.length - 1, idx));
    setHover(idx);
  };

  return (
    <div className="relative w-full">
      <svg viewBox={`0 0 ${w} ${h}`} className="w-full" preserveAspectRatio="none"
        onMouseMove={onMove} onMouseLeave={() => setHover(null)}>
        <defs>
          <linearGradient id="ag" x1="0" x2="0" y1="0" y2="1">
            <stop offset="0%" stopColor={color} stopOpacity="0.25" />
            <stop offset="100%" stopColor={color} stopOpacity="0" />
          </linearGradient>
        </defs>
        {ticks.map((f, i) => {
          const y = pad.t + ih - f * ih;
          return (
            <g key={i}>
              <line x1={pad.l} x2={w - pad.r} y1={y} y2={y} stroke="var(--border)" strokeDasharray="2 3" strokeWidth="1" />
              <text x={pad.l - 6} y={y + 3} textAnchor="end" fontSize="10" fill="var(--muted-foreground)" fontFamily="ui-monospace,monospace">{valueFormatter(max * f)}</text>
            </g>
          );
        })}
        {data.map((d, i) => i % Math.ceil(data.length / 6) === 0 && (
          <text key={i} x={xs[i]} y={h - 8} textAnchor="middle" fontSize="10" fill="var(--muted-foreground)">{fmtDate(String(d[xKey]))}</text>
        ))}
        <path d={pathArea} fill="url(#ag)" />
        <path d={pathLine} fill="none" stroke={color} strokeWidth="1.75" strokeLinejoin="round" />
        {hover !== null && (
          <g>
            <line x1={xs[hover]} x2={xs[hover]} y1={pad.t} y2={pad.t + ih} stroke="var(--border)" strokeWidth="1" />
            <circle cx={xs[hover]} cy={ys[hover]} r="4" fill="var(--background)" stroke={color} strokeWidth="2" />
          </g>
        )}
      </svg>
      {hover !== null && (
        <div className="pointer-events-none absolute rounded-md border border-border bg-popover px-2.5 py-1.5 text-xs shadow-lg"
          style={{ left: `calc(${(xs[hover] / w) * 100}% + 10px)`, top: `calc(${(ys[hover] / h) * 100}% - 10px)` }}>
          <div className="font-medium">{fmtDate(String(data[hover][xKey]))}</div>
          <div className="text-muted-foreground tabular-nums">{valueFormatter(Number(data[hover][yKey]))}</div>
        </div>
      )}
    </div>
  );
}

// Stacked Bar Chart
export function StackedBarChart({ data, xKey, series, colors, height = 220 }: {
  data: Array<Record<string, number | string>>;
  xKey: string;
  series: string[];
  colors: string[];
  height?: number;
}) {
  const [hover, setHover] = useState<number | null>(null);
  const pad = { l: 50, r: 12, t: 12, b: 26 };
  const w = 680, h = height;
  const iw = w - pad.l - pad.r;
  const ih = h - pad.t - pad.b;
  const totals = data.map((d) => series.reduce((s, k) => s + Number(d[k] || 0), 0));
  const max = Math.max(...totals) || 1;
  const barW = (iw / data.length) * 0.7;
  const step = iw / data.length;

  return (
    <div className="relative w-full">
      <svg viewBox={`0 0 ${w} ${h}`} className="w-full" preserveAspectRatio="none">
        {[0, 0.25, 0.5, 0.75, 1].map((f, i) => {
          const y = pad.t + ih - f * ih;
          return (
            <g key={i}>
              <line x1={pad.l} x2={w - pad.r} y1={y} y2={y} stroke="var(--border)" strokeDasharray="2 3" />
              <text x={pad.l - 6} y={y + 3} textAnchor="end" fontSize="10" fill="var(--muted-foreground)" fontFamily="ui-monospace,monospace">{fmtNum(max * f)}</text>
            </g>
          );
        })}
        {data.map((d, i) => {
          const x = pad.l + step * i + (step - barW) / 2;
          let yAcc = pad.t + ih;
          return (
            <g key={i} onMouseEnter={() => setHover(i)} onMouseLeave={() => setHover(null)}>
              {i % Math.ceil(data.length / 6) === 0 && (
                <text x={x + barW / 2} y={h - 8} textAnchor="middle" fontSize="10" fill="var(--muted-foreground)">{fmtDate(String(d[xKey]))}</text>
              )}
              {series.map((k, si) => {
                const hVal = (Number(d[k] || 0) / max) * ih;
                yAcc -= hVal;
                return <rect key={k} x={x} y={yAcc} width={barW} height={hVal} fill={colors[si]} opacity={hover === null || hover === i ? 1 : 0.4} rx={si === series.length - 1 ? 2 : 0} />;
              })}
              <rect x={x - 2} y={pad.t} width={barW + 4} height={ih} fill="transparent" />
            </g>
          );
        })}
      </svg>
      {hover !== null && (
        <div className="pointer-events-none absolute rounded-md border border-border bg-popover px-2.5 py-1.5 text-xs shadow-lg"
          style={{ left: `calc(${((pad.l + step * hover + step / 2) / w) * 100}%)`, top: 6, transform: "translateX(-50%)" }}>
          <div className="font-medium">{fmtDate(String(data[hover][xKey]))}</div>
          {series.map((k, i) => (
            <div key={k} className="flex items-center gap-1.5 text-muted-foreground">
              <span className="h-2 w-2 rounded-[2px]" style={{ background: colors[i] }} />
              <span className="capitalize">{k.replace("_tokens", "").replace(/_/g, " ")}</span>
              <span className="tabular-nums text-foreground ml-auto">{fmtNum(Number(data[hover][k] || 0))}</span>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}

// Horizontal Bars
export function HorizontalBars({ data, labelKey, valueKey, colorKey = "color", valueFormatter = fmtNum, subValueFn }: {
  data: Array<Record<string, string | number>>;
  labelKey: string;
  valueKey: string;
  colorKey?: string;
  valueFormatter?: (v: number) => string;
  subValueFn?: (d: Record<string, string | number>) => string;
}) {
  const max = Math.max(...data.map((d) => Number(d[valueKey]))) || 1;
  return (
    <div className="flex flex-col gap-3">
      {data.map((d, i) => {
        const pct = (Number(d[valueKey]) / max) * 100;
        const color = providerColor(String(d[colorKey] || "zinc"));
        return (
          <div key={i}>
            <div className="flex items-baseline justify-between gap-3 mb-1">
              <div className="flex items-center gap-2 min-w-0">
                <span className="h-2 w-2 rounded-[2px] shrink-0" style={{ background: color }} />
                <span className="text-xs font-medium truncate">{String(d[labelKey])}</span>
              </div>
              <div className="flex items-baseline gap-2 text-xs">
                {subValueFn && <span className="text-muted-foreground tabular-nums">{subValueFn(d)}</span>}
                <span className="font-semibold tabular-nums">{valueFormatter(Number(d[valueKey]))}</span>
              </div>
            </div>
            <div className="h-1.5 w-full rounded-full bg-muted overflow-hidden">
              <div className="h-full rounded-full transition-all" style={{ width: `${pct}%`, background: color }} />
            </div>
          </div>
        );
      })}
    </div>
  );
}

// Sparkline
export function Sparkline({ data, color = "oklch(0.55 0.19 290)", height = 32, className }: { data: number[]; color?: string; height?: number; className?: string }) {
  const w = 120;
  const max = Math.max(...data);
  const min = Math.min(...data);
  const range = max - min || 1;
  const pts = data.map((v, i) => [((i / (data.length - 1)) * w), height - ((v - min) / range) * height]);
  const d = pts.map((p, i) => `${i === 0 ? "M" : "L"} ${p[0].toFixed(1)} ${p[1].toFixed(1)}`).join(" ");
  const area = `${d} L ${w} ${height} L 0 ${height} Z`;
  return (
    <svg viewBox={`0 0 ${w} ${height}`} className={`w-full ${className || ""}`} preserveAspectRatio="none">
      <defs>
        <linearGradient id="sg" x1="0" x2="0" y1="0" y2="1">
          <stop offset="0%" stopColor={color} stopOpacity="0.3" />
          <stop offset="100%" stopColor={color} stopOpacity="0" />
        </linearGradient>
      </defs>
      <path d={area} fill="url(#sg)" />
      <path d={d} fill="none" stroke={color} strokeWidth="1.5" />
    </svg>
  );
}

// Timing Waterfall
export function TimingWaterfall({ timing }: { timing: { dns_ms: number; tls_ms: number; ttfb_ms: number; stream_ms: number } }) {
  const total = timing.dns_ms + timing.tls_ms + timing.ttfb_ms + timing.stream_ms;
  const segs = [
    { label: "DNS", ms: timing.dns_ms, color: "oklch(0.55 0.01 260)" },
    { label: "TLS", ms: timing.tls_ms, color: "oklch(0.72 0.15 70)" },
    { label: "TTFB wait", ms: timing.ttfb_ms, color: "oklch(0.55 0.19 290)" },
    { label: "Stream", ms: timing.stream_ms, color: "oklch(0.60 0.12 195)" },
  ];
  let offset = 0;
  return (
    <div className="flex flex-col gap-2">
      <div className="flex items-center justify-between mb-1">
        <div className="text-xs font-medium">Timing breakdown</div>
        <div className="text-xs font-mono text-muted-foreground tabular-nums">total {total}ms</div>
      </div>
      {segs.map((s, i) => {
        const startPct = (offset / total) * 100;
        const widthPct = Math.max(0.5, (s.ms / total) * 100);
        offset += s.ms;
        return (
          <div key={i} className="grid grid-cols-[90px_1fr_70px] items-center gap-3 text-xs">
            <div className="text-muted-foreground">{s.label}</div>
            <div className="relative h-5 rounded bg-muted/50">
              <div className="absolute top-0 bottom-0 rounded" style={{ left: `${startPct}%`, width: `${widthPct}%`, background: s.color }} />
            </div>
            <div className="font-mono tabular-nums text-right">{s.ms}ms</div>
          </div>
        );
      })}
    </div>
  );
}
