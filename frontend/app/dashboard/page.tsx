"use client";
import { useState, useEffect, useCallback } from "react";
import { RefreshCw, Activity, DollarSign, Clock, Zap, AlertTriangle, Layers, TrendingUp, TrendingDown, type LucideIcon } from "lucide-react";
import { Topbar } from "@/components/shell/Sidebar";
import { Card, CardHeader, CardTitle, CardDescription, CardContent, Skeleton, DateTimeRangePicker, InfoTip } from "@/components/ui";
import { AreaChart, StackedBarChart, HorizontalBars, Sparkline, providerColor } from "@/components/charts";
import { api, type AnalyticsSummary } from "@/lib/api";
import { fmtNum, fmtMs, fmtToman, fmtUSD } from "@/lib/utils";

const KPI_INFO = {
  requests: "Count of successfully proxied requests across every enabled provider in the selected period.",
  cost: "Sum of upstream provider costs, computed per-request from the pricing table you set on each provider.",
  latency: "Server-side total: time from LLMeter receiving the request to the final byte being sent back. p95 shown as reference.",
  ttfb: "Time to First Byte. Measured from when LLMeter dispatches the upstream request until the first chunk arrives.",
  error: "Percentage of requests that returned a 4xx or 5xx status, including rate limits after all retries are exhausted.",
  tokens: "Total tokens consumed across all requests in the period. Prompt + cache + completion tokens combined.",
};

function mkSpark(seed: number, n = 20) {
  let s = seed;
  const rnd = () => { s = Math.imul(s ^ (s >>> 15), s | 1); s ^= s + Math.imul(s ^ (s >>> 7), s | 61); return ((s ^ (s >>> 14)) >>> 0) / 4294967296; };
  return Array.from({ length: n }, (_, i) => 50 + Math.sin(i / 3) * 12 + rnd() * 14);
}

interface DateRange { start: Date; end: Date; preset: string; }

function KPICard({ icon: Icon, label, value, sub, delta, deltaInvert, sparkData, sparkColor, info }: {
  icon: LucideIcon;
  label: string; value: string; sub?: string;
  delta?: number; deltaInvert?: boolean;
  sparkData?: number[]; sparkColor?: string; info?: string;
}) {
  const isPositive = (delta ?? 0) > 0;
  const isGood = deltaInvert ? !isPositive : isPositive;
  const DeltaIcon = isPositive ? TrendingUp : TrendingDown;

  return (
    <Card>
      <div className="p-3.5 md:p-5">
        <div className="flex items-center justify-between mb-2.5">
          <div className="flex items-center gap-1.5 text-xs font-medium text-muted-foreground">
            <Icon size={13} />
            <span className="truncate">{label}</span>
            {info && <InfoTip>{info}</InfoTip>}
          </div>
          {delta != null && (
            <span className={`inline-flex items-center gap-0.5 text-[11px] font-medium tabular-nums shrink-0 ${isGood ? "text-emerald-600 dark:text-emerald-400" : "text-red-600 dark:text-red-400"}`}>
              <DeltaIcon size={11} />
              {Math.abs(delta).toFixed(1)}%
            </span>
          )}
        </div>
        <div className="flex items-end justify-between gap-2">
          <div className="min-w-0">
            <div className="text-2xl md:text-[28px] font-semibold tracking-tight tabular-nums leading-none">{value}</div>
            {sub && <div className="text-[10.5px] text-muted-foreground mt-1.5 truncate">{sub}</div>}
          </div>
          {sparkData && (
            <div className="hidden md:block w-[72px] h-8 shrink-0 opacity-90">
              <Sparkline data={sparkData} color={sparkColor} height={32} />
            </div>
          )}
        </div>
      </div>
    </Card>
  );
}

export default function DashboardPage() {
  const [range, setRange] = useState<DateRange>(() => {
    const end = new Date();
    const start = new Date(end.getTime() - 30 * 24 * 60 * 60 * 1000);
    return { start, end, preset: "Last 30 days" };
  });
  const [data, setData] = useState<AnalyticsSummary | null>(null);
  const [loading, setLoading] = useState(true);

  const fc = (n: number) => data?.currency === "IRT" ? fmtToman(n) : fmtUSD(n);

  const load = useCallback(async () => {
    setLoading(true);
    try {
      // Re-anchor relative presets to now on every call so auto-refresh stays current
      let from = range.start;
      let to = range.end;
      if (range.preset !== "Custom") {
        to = new Date();
        from = new Date(to.getTime() - (range.end.getTime() - range.start.getTime()));
      }
      const result = await api.getAnalytics(from.toISOString(), to.toISOString());
      setData(result);
    } catch (e) { console.error(e); }
    finally { setLoading(false); }
  }, [range]);

  useEffect(() => { load(); }, [load]);

  // Auto-refresh every 15 seconds
  useEffect(() => {
    const id = setInterval(() => load(), 15000);
    return () => clearInterval(id);
  }, [load]);

  return (
    <>
      <Topbar title="Dashboard" subtitle="Real-time proxy analytics"
        right={
          <>
            <DateTimeRangePicker value={range} onChange={setRange} />
            <button onClick={load} title="Refresh" className="inline-flex items-center justify-center h-8 w-8 rounded-md border border-border text-muted-foreground hover:text-foreground hover:bg-muted transition-colors">
              <RefreshCw size={13} className={loading ? "animate-spin" : ""} />
            </button>
          </>
        }
      />

      <div className="p-4 md:p-6 flex flex-col gap-5 max-w-[1400px]">
        {/* KPI Cards */}
        {loading ? (
          <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-6 gap-3">
            {Array.from({ length: 6 }).map((_, i) => <Skeleton key={i} className="h-[112px]" />)}
          </div>
        ) : data ? (
          <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-6 gap-3">
            <KPICard icon={Activity} label="Total requests" value={fmtNum(data.total_requests)} delta={data.delta_requests} sub="vs previous period" info={KPI_INFO.requests} sparkData={mkSpark(1)} sparkColor="oklch(0.55 0.19 290)" />
            <KPICard icon={DollarSign} label={`Total cost (${data.currency})`} value={fc(data.total_cost)} delta={data.delta_cost} deltaInvert sub="vs previous period" info={KPI_INFO.cost} sparkData={mkSpark(2)} sparkColor="oklch(0.60 0.12 195)" />
            <KPICard icon={Clock} label="Avg latency" value={fmtMs(data.avg_latency_ms)} delta={data.delta_latency} deltaInvert sub={`p95 ${fmtMs(data.p95_latency_ms)}`} info={KPI_INFO.latency} sparkData={mkSpark(3)} sparkColor="oklch(0.72 0.15 70)" />
            <KPICard icon={Zap} label="Avg TTFB" value={fmtMs(data.avg_ttfb_ms)} delta={data.delta_ttfb} deltaInvert sub={`p95 ${fmtMs(data.p95_ttfb_ms)}`} info={KPI_INFO.ttfb} sparkData={mkSpark(4)} sparkColor="oklch(0.55 0.01 260)" />
            <KPICard icon={AlertTriangle} label="Error rate" value={data.error_rate.toFixed(2) + "%"} delta={data.delta_error_rate} deltaInvert sub={`${fmtNum(data.error_count)} errors`} info={KPI_INFO.error} sparkData={mkSpark(5)} sparkColor="oklch(0.60 0.18 15)" />
            <KPICard icon={Layers} label="Total tokens" value={fmtNum(data.total_tokens)} sub={`${fmtNum(data.total_prompt_tokens)} prompt · ${fmtNum(data.total_completion_tokens)} completion`} info={KPI_INFO.tokens} sparkData={mkSpark(6)} sparkColor="oklch(0.55 0.15 330)" />
          </div>
        ) : null}

        {/* Charts row */}
        <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
          <Card>
            <CardHeader>
              <div className="flex items-baseline justify-between">
                <div>
                  <CardTitle>Cost over time</CardTitle>
                  <CardDescription>Daily spend across all providers</CardDescription>
                </div>
                <div className="text-xs text-muted-foreground tabular-nums">{range.preset}</div>
              </div>
            </CardHeader>
            <CardContent>
              {loading ? <Skeleton className="h-[220px]" /> : data?.cost_over_time.length ? (
                <AreaChart data={data.cost_over_time} xKey="date" yKey="cost" color="oklch(0.55 0.19 290)" valueFormatter={fc} />
              ) : <div className="h-[220px] flex items-center justify-center text-sm text-muted-foreground">No data</div>}
            </CardContent>
          </Card>

          <Card>
            <CardHeader>
              <div className="flex items-baseline justify-between">
                <div>
                  <CardTitle>Token usage</CardTitle>
                  <CardDescription>Prompt · cache · completion, daily</CardDescription>
                </div>
                <div className="flex items-center gap-3 text-[11px] text-muted-foreground">
                  <span className="inline-flex items-center gap-1.5"><span className="h-2 w-2 rounded-sm" style={{ background: "oklch(0.55 0.01 260)" }} />prompt</span>
                  <span className="inline-flex items-center gap-1.5"><span className="h-2 w-2 rounded-sm" style={{ background: "oklch(0.72 0.15 70)" }} />cache</span>
                  <span className="inline-flex items-center gap-1.5"><span className="h-2 w-2 rounded-sm" style={{ background: "oklch(0.55 0.19 290)" }} />completion</span>
                </div>
              </div>
            </CardHeader>
            <CardContent>
              {loading ? <Skeleton className="h-[220px]" /> : data?.cost_over_time.length ? (
                <StackedBarChart data={data.cost_over_time} xKey="date"
                  series={["prompt_tokens", "cache_tokens", "completion_tokens"]}
                  colors={["oklch(0.55 0.01 260)", "oklch(0.72 0.15 70)", "oklch(0.55 0.19 290)"]} />
              ) : <div className="h-[220px] flex items-center justify-center text-sm text-muted-foreground">No data</div>}
            </CardContent>
          </Card>
        </div>

        {/* Bottom charts */}
        <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
          <Card>
            <CardHeader>
              <CardTitle>Cost by provider</CardTitle>
              <CardDescription>Within selected period</CardDescription>
            </CardHeader>
            <CardContent>
              {loading ? <Skeleton className="h-[160px]" /> : data?.by_provider.length ? (
                <HorizontalBars
                  data={data.by_provider.map(p => ({ ...p, name: p.provider_name, color: p.provider_color, cost: p.cost }))}
                  labelKey="name" valueKey="cost" colorKey="color"
                  valueFormatter={fc}
                  subValueFn={(d) => `${fmtNum(Number(d.count))} req`}
                />
              ) : <div className="text-sm text-muted-foreground">No data</div>}
            </CardContent>
          </Card>
          <Card>
            <CardHeader>
              <CardTitle>Top models</CardTitle>
              <CardDescription>By request volume</CardDescription>
            </CardHeader>
            <CardContent>
              {loading ? <Skeleton className="h-[160px]" /> : data?.by_model.length ? (
                <HorizontalBars
                  data={data.by_model.map(m => ({ ...m, color: "violet" }))}
                  labelKey="model" valueKey="count" colorKey="color"
                  valueFormatter={(v) => fmtNum(v)}
                  subValueFn={(d) => `avg ${fc(Number(d.avg_cost))}`}
                />
              ) : <div className="text-sm text-muted-foreground">No data</div>}
            </CardContent>
          </Card>
        </div>
      </div>
    </>
  );
}
