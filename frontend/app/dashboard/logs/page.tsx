"use client";
import { useState, useEffect, useCallback, useMemo } from "react";
import { RefreshCw, Search, Hash, ChevronRight, ChevronLeft, ChevronsLeft, ChevronsRight, X, Check, Copy, ScrollText, Route } from "lucide-react";
import { Topbar } from "@/components/shell/Sidebar";
import { Card, Badge, Dialog, Tabs, TabsList, TabsTrigger, TabsContent, Skeleton, Select, DateTimeRangePicker, InfoTip, Input, Textarea, useToast } from "@/components/ui";
import { TimingWaterfall } from "@/components/charts";
import { api, type LogItem, type LogDetail, type AppSettings, type LogSummary } from "@/lib/api";
import { fmtDateTimeShort, fmtDateTime, fmtMs, fmtUSD, fmtToman, fmtNum, fmtCost } from "@/lib/utils";

function StatusBadge({ status }: { status: number }) {
  if (status >= 500) return <Badge variant="destructive"><span className="font-mono">{status}</span></Badge>;
  if (status >= 400) return <Badge variant="warning"><span className="font-mono">{status}</span></Badge>;
  return <Badge variant="success"><span className="font-mono">{status}</span></Badge>;
}

function LatencyBar({ ms }: { ms: number }) {
  const max = 5000;
  const pct = Math.min(100, (ms / max) * 100);
  const color = ms < 1000 ? "oklch(0.65 0.15 155)" : ms < 3000 ? "oklch(0.72 0.15 70)" : "oklch(0.60 0.18 15)";
  return (
    <div className="flex items-center gap-2 w-full">
      <div className="flex-1 h-1.5 rounded-full bg-muted overflow-hidden min-w-[40px]">
        <div className="h-full rounded-full" style={{ width: `${pct}%`, background: color }} />
      </div>
      <span className="text-[11px] font-mono tabular-nums text-muted-foreground shrink-0 w-14 text-right">{fmtMs(ms)}</span>
    </div>
  );
}

function FilterLabel({ children, tip }: { children: React.ReactNode; tip: string }) {
  return (
    <div className="flex items-center gap-0.5 text-[10px] font-medium text-muted-foreground uppercase tracking-wide mb-1">
      {children}
      <InfoTip>{tip}</InfoTip>
    </div>
  );
}

function PageNumbers({ page, totalPages, onChange }: { page: number; totalPages: number; onChange: (p: number) => void }) {
  const pages: Array<number | string> = [];
  const add = (p: number | string) => pages.push(p);
  add(1);
  if (page - 1 > 2) add("…l");
  for (let p = Math.max(2, page - 1); p <= Math.min(totalPages - 1, page + 1); p++) add(p);
  if (page + 1 < totalPages - 1) add("…r");
  if (totalPages > 1) add(totalPages);

  return (
    <div className="flex items-center gap-0.5">
      {pages.map((p, i) =>
        typeof p === "number" ? (
          <button key={i} onClick={() => onChange(p)}
            className={`h-7 min-w-[28px] rounded px-1.5 text-[11px] font-medium tabular-nums ${p === page ? "bg-accent text-accent-fg" : "hover:bg-muted text-muted-foreground hover:text-accent"}`}>
            {p}
          </button>
        ) : <span key={i} className="px-1 text-[11px] text-muted-foreground select-none">…</span>
      )}
    </div>
  );
}

interface DateRange { start: Date; end: Date; preset: string; }

function LogDetailDialog({ log, open, onOpenChange, settings }: { log: LogDetail | null; open: boolean; onOpenChange: (v: boolean) => void; settings: AppSettings | null }) {
  const [tab, setTab] = useState("overview");
  const [copied, setCopied] = useState<string | null>(null);
  const [showSecondary, setShowSecondary] = useState(false);

  const currency = settings?.default_currency || "USD";
  const rate = settings?.usd_to_toman_rate || 0;
  const hasSecondary = rate > 0;
  const fc = (n: number, d?: number) => fmtCost(n, currency, rate, d);

  useEffect(() => { if (open) { setTab("overview"); setShowSecondary(false); } }, [open, log?.id]);
  if (!log) return null;

  const reqJson = JSON.stringify(log.request_body || { model: log.model_requested, messages: [{ role: "user", content: "…" }] }, null, 2);
  const resJson = JSON.stringify(log.response_body || (log.status_code >= 400 ? { error: { message: log.error_message, code: log.status_code } } : {}), null, 2);

  const copy = (text: string, key: string) => {
    navigator.clipboard.writeText(text);
    setCopied(key);
    setTimeout(() => setCopied(null), 1500);
  };

  const timing = {
    dns_ms: log.timing_dns_ms,
    tls_ms: log.timing_tls_ms,
    ttfb_ms: log.ttfb_ms,
    stream_ms: Math.max(0, log.latency_ms - log.ttfb_ms),
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange} size="lg">
      <div className="flex h-14 items-center justify-between border-b border-border px-5">
        <div className="flex items-center gap-3 min-w-0">
          <code className="text-xs font-mono truncate">{log.request_id}</code>
          <StatusBadge status={log.status_code} />
        </div>
        <button onClick={() => onOpenChange(false)} className="h-8 w-8 inline-flex items-center justify-center rounded-md hover:bg-muted"><X size={16} /></button>
      </div>

      <div className="border-b border-border overflow-x-auto">
        <div className="px-5 py-2 min-w-max">
          <Tabs value={tab} onValueChange={setTab}>
            <TabsList>
              <TabsTrigger value="overview">Overview</TabsTrigger>
              <TabsTrigger value="request">Request JSON</TabsTrigger>
              <TabsTrigger value="response">Response JSON</TabsTrigger>
              <TabsTrigger value="timing">Timing</TabsTrigger>
            </TabsList>
          </Tabs>
        </div>
      </div>

      <div className="max-h-[60vh] overflow-y-auto p-5">
        {tab === "overview" && (
          <div className="flex flex-col gap-3">
            {/* Route — prominent full-width bar */}
            {log.route && (
              <div className="flex items-center gap-3 rounded-md border border-border bg-muted/30 px-3 py-2.5">
                <Route size={13} className="text-muted-foreground shrink-0" />
                <code className="flex-1 text-xs font-mono text-foreground break-all">{log.route}</code>
                <button onClick={() => copy(log.route!, "route")}
                  className="shrink-0 inline-flex items-center gap-1 text-[10px] text-muted-foreground hover:text-foreground">
                  {copied === "route" ? <><Check size={10} />Copied</> : <><Copy size={10} />Copy</>}
                </button>
              </div>
            )}

            <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
              {[
                ["Provider", log.provider_name],
                ["Model", log.model_used],
                ["Status", <StatusBadge key="s" status={log.status_code} />],
                ["Cost", (
                  <div key="cost" className="flex flex-col gap-0.5">
                    <span className="font-medium tabular-nums">{fc(log.cost_usd, 6)}</span>
                    {hasSecondary && (
                      <button onClick={() => setShowSecondary(!showSecondary)}
                        className="text-[10px] text-muted-foreground hover:text-foreground text-left w-fit">
                        {showSecondary
                          ? <><span className="font-mono">{currency === "IRT" ? fmtUSD(log.cost_usd, 6) : fmtToman(log.cost_usd * rate)}</span> · hide</>
                          : "show in " + (currency === "IRT" ? "USD" : "Toman")}
                      </button>
                    )}
                  </div>
                )],
                ["Prompt tokens", fmtNum(log.prompt_tokens)],
                ["Cache tokens", fmtNum(log.cache_tokens)],
                ["Completion tokens", fmtNum(log.completion_tokens)],
                ["Total tokens", fmtNum(log.total_tokens)],
                ["Latency", fmtMs(log.latency_ms)],
                ["TTFB", fmtMs(log.ttfb_ms)],
                ["Timestamp", <span key="ts" className="font-mono text-xs">{fmtDateTime(log.created_at)}</span>],
              ].map(([label, value], i) => (
                <div key={i} className="rounded-md border border-border p-3">
                  <div className="text-[10px] uppercase tracking-wide text-muted-foreground mb-1">{label}</div>
                  <div className="text-sm tabular-nums">{value}</div>
                </div>
              ))}
            </div>

            {log.error_message && (
              <div className="rounded-md border border-red-500/30 bg-red-500/5 p-3 flex items-start gap-2.5">
                <svg className="text-red-500 mt-0.5 shrink-0" width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><path d="M10.29 3.86 1.82 18a2 2 0 0 0 1.71 3h16.94a2 2 0 0 0 1.71-3L13.71 3.86a2 2 0 0 0-3.42 0z"/><line x1="12" y1="9" x2="12" y2="13"/><line x1="12" y1="17" x2="12.01" y2="17"/></svg>
                <div>
                  <div className="text-xs font-semibold text-red-700 dark:text-red-400">Error</div>
                  <div className="text-xs text-muted-foreground font-mono mt-0.5">{log.error_message}</div>
                </div>
              </div>
            )}
          </div>
        )}
        {(tab === "request" || tab === "response") && (
          <div className="relative rounded-md border border-border bg-muted/30 overflow-hidden">
            <div className="flex items-center justify-between border-b border-border px-3 py-1.5">
              <span className="text-[10px] text-muted-foreground uppercase tracking-wide">application/json</span>
              <button onClick={() => copy(tab === "request" ? reqJson : resJson, tab)}
                className="inline-flex items-center gap-1 text-[11px] text-muted-foreground hover:text-foreground">
                {copied === tab ? <><Check size={11} />Copied</> : <><Copy size={11} />Copy</>}
              </button>
            </div>
            <pre className="p-4 text-[11.5px] font-mono leading-relaxed overflow-x-auto"><code>{tab === "request" ? reqJson : resJson}</code></pre>
          </div>
        )}
        {tab === "timing" && <TimingWaterfall timing={timing} />}
      </div>
    </Dialog>
  );
}

export default function LogsPage() {
  const [provider, setProvider] = useState("All");
  const [model, setModel] = useState("All");
  const [status, setStatus] = useState("All");
  const [search, setSearch] = useState("");
  const [range, setRange] = useState<DateRange>(() => {
    const end = new Date();
    const start = new Date(end.getTime() - 24 * 60 * 60 * 1000);
    return { start, end, preset: "Last 24 hours" };
  });
  const [page, setPage] = useState(1);
  const [perPage, setPerPage] = useState(50);
  const [total, setTotal] = useState(0);
  const [items, setItems] = useState<LogItem[]>([]);
  const [loading, setLoading] = useState(true);
  const [summary, setSummary] = useState<LogSummary | null>(null);
  const [summaryOpen, setSummaryOpen] = useState(true);
  const [selected, setSelected] = useState<LogDetail | null>(null);
  const [detailOpen, setDetailOpen] = useState(false);
  const [providers, setProviders] = useState<string[]>([]);
  const [distinctModels, setDistinctModels] = useState<string[]>([]);
  const [settings, setSettings] = useState<AppSettings | null>(null);
  const [bulkMode, setBulkMode] = useState(false);
  const [bulkText, setBulkText] = useState("");
  const toast = useToast();

  const currency = settings?.default_currency || "USD";
  const rate = settings?.usd_to_toman_rate || 0;
  const fc = (n: number, d?: number) => fmtCost(n, currency, rate, d);

  const bulkIds = useMemo(() => {
    const seen = new Set<string>();
    return bulkText.split(/[\n,\s]+/).map((s) => s.trim()).filter((s) => {
      if (!s || seen.has(s)) return false;
      seen.add(s);
      return true;
    });
  }, [bulkText]);

  const load = useCallback(async () => {
    setLoading(true);
    try {
      if (bulkMode) {
        if (bulkIds.length === 0) { setItems([]); setTotal(0); setSummary(null); return; }
        const res = await api.bulkSearchLogs(bulkIds, page, perPage);
        setItems(res.items);
        setTotal(res.total);
        setSummary(null);
      } else {
        const params = {
          page, limit: perPage,
          provider: provider !== "All" ? provider : undefined,
          model: model !== "All" ? model : undefined,
          status: status !== "All" ? status : undefined,
          from_time: range.start.toISOString(),
          to_time: range.end.toISOString(),
          search: search || undefined,
        };
        const [logsRes, summaryRes] = await Promise.all([
          api.getLogs(params),
          api.getLogsSummary(params),
        ]);
        setItems(logsRes.items);
        setTotal(logsRes.total);
        setSummary(summaryRes);
      }
    } catch (e) { console.error(e); }
    finally { setLoading(false); }
  }, [page, perPage, provider, model, status, range, search, bulkMode, bulkIds]);

  useEffect(() => { load(); }, [load]);

  // Auto-refresh every 15 seconds
  useEffect(() => {
    const id = setInterval(() => load(), 15000);
    return () => clearInterval(id);
  }, [load]);

  useEffect(() => {
    api.getProviders().then((ps) => setProviders(ps.map((p) => p.name))).catch(() => {});
    api.getSettings().then(setSettings).catch(() => {});
    api.getDistinctModels().then((r) => setDistinctModels(r.models)).catch(() => {});
  }, []);

  const totalPages = Math.max(1, Math.ceil(total / perPage));

  const openDetail = async (log: LogItem) => {
    try {
      const detail = await api.getLog(log.id);
      setSelected(detail);
      setDetailOpen(true);
    } catch { toast({ variant: "destructive", title: "Failed to load details" }); }
  };

  const hasFilters = provider !== "All" || model !== "All" || status !== "All" || !!search;

  return (
    <>
      <Topbar title="Request Logs" subtitle={`${total.toLocaleString()} requests`}
        right={<>
          <DateTimeRangePicker value={range} onChange={(r) => { setRange(r); setPage(1); }} />
          <button onClick={load} title="Refresh" className="inline-flex items-center justify-center h-8 w-8 rounded-md border border-border text-muted-foreground hover:text-foreground hover:bg-muted transition-colors">
            <RefreshCw size={13} className={loading ? "animate-spin" : ""} />
          </button>
        </>}
      />

      <div className="p-4 md:p-6 flex flex-col gap-4 max-w-[1600px]">

        {/* Filter bar */}
        {!bulkMode ? (
          <div className="flex flex-wrap items-end gap-3">
            {/* Search */}
            <div>
              <FilterLabel tip="Filter by request ID or model name">Search</FilterLabel>
              <div className="relative">
                <Search size={13} className="absolute left-2.5 top-1/2 -translate-y-1/2 text-muted-foreground" />
                <Input value={search} onChange={(e) => { setSearch(e.target.value); setPage(1); }}
                  placeholder="ID or model…" className="h-9 pl-8 w-[200px] text-xs" />
              </div>
            </div>

            {/* Provider */}
            <div>
              <FilterLabel tip="Filter by the upstream LLM provider that handled the request">Provider</FilterLabel>
              <Select value={provider} onChange={(v) => { setProvider(v); setPage(1); }}
                options={["All", ...providers]} className="w-[160px]" />
            </div>

            {/* Model */}
            <div>
              <FilterLabel tip="Filter by the actual model used after alias resolution — populated from your real request history">Model</FilterLabel>
              <Select value={model} onChange={(v) => { setModel(v); setPage(1); }}
                options={["All", ...distinctModels]} className="w-[200px]" />
            </div>

            {/* Status */}
            <div>
              <FilterLabel tip="2xx = success · 4xx = client/auth error · 5xx = provider or proxy error">Status</FilterLabel>
              <Select value={status} onChange={(v) => { setStatus(v); setPage(1); }}
                options={["All", "2xx", "4xx", "5xx"]} className="w-[100px]" />
            </div>

            <div className="flex items-end gap-2 ml-auto">
              {hasFilters && (
                <button onClick={() => { setProvider("All"); setModel("All"); setStatus("All"); setSearch(""); setPage(1); }}
                  className="inline-flex items-center gap-1 h-8 px-2.5 rounded-md text-xs text-muted-foreground hover:text-foreground hover:bg-muted">
                  <X size={12} />Clear
                </button>
              )}
              <span className="text-xs text-muted-foreground tabular-nums">{total.toLocaleString()} results</span>
              <button onClick={() => { setBulkMode(true); setBulkText(""); setPage(1); }}
                className="inline-flex items-center gap-1.5 h-8 px-3 rounded-md border border-border text-xs font-medium hover:bg-muted">
                <Hash size={12} />Bulk ID search
              </button>
            </div>
          </div>
        ) : (
          <div className="flex flex-col gap-2">
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-2">
                <Hash size={13} className="text-muted-foreground" />
                <span className="text-xs font-semibold">Bulk request ID search</span>
                {bulkIds.length > 0 && <span className="text-[11px] text-muted-foreground">{bulkIds.length} ID{bulkIds.length !== 1 ? "s" : ""} detected</span>}
              </div>
              <button onClick={() => { setBulkMode(false); setBulkText(""); setPage(1); }}
                className="inline-flex items-center gap-1 h-7 px-2.5 rounded-md text-xs text-muted-foreground hover:text-foreground hover:bg-muted">
                <X size={12} />Exit bulk search
              </button>
            </div>
            <Textarea
              value={bulkText}
              onChange={(e) => { setBulkText(e.target.value); setPage(1); }}
              placeholder={"Paste request IDs separated by commas, newlines, or spaces…\nchatcmpl-abc123, chatcmpl-def456\nreq_xyz789"}
              className="font-mono text-[11px] min-h-[80px] max-h-[160px] resize-y"
            />
            {bulkIds.length > 0 && (
              <div className="flex items-center gap-2 text-[11px] text-muted-foreground">
                <span>{total.toLocaleString()} results found</span>
                <button onClick={() => { setBulkText(""); setPage(1); }} className="hover:text-foreground underline underline-offset-2">Clear</button>
              </div>
            )}
          </div>
        )}

        {/* Expandable summary */}
        <Card className="overflow-hidden">
          <button onClick={() => setSummaryOpen(!summaryOpen)}
            className="flex w-full items-center justify-between px-4 py-2.5 text-left hover:bg-muted/40 transition-colors">
            <div className="flex items-center gap-2">
              <ChevronRight size={14} className={`text-muted-foreground transition-transform ${summaryOpen ? "rotate-90" : ""}`} />
              <span className="text-xs font-semibold">Summary</span>
              <span className="text-[11px] text-muted-foreground">for current filter</span>
            </div>
            <div className="hidden sm:flex items-center gap-4 text-[11px] text-muted-foreground font-mono tabular-nums">
              {summary && (
                <>
                  <span>{fmtNum(summary.total_requests)} req</span><span>·</span>
                  <span>{fc(summary.total_cost_usd)}</span><span>·</span>
                  <span>avg {fmtMs(summary.avg_latency_ms)}</span>
                </>
              )}
            </div>
          </button>
          {summaryOpen && summary && (
            <div className="border-t border-border grid grid-cols-2 md:grid-cols-6 divide-y md:divide-y-0 md:divide-x divide-border bg-muted/20">
              {[
                { label: "Requests", value: fmtNum(summary.total_requests), sub: <span><span className="text-emerald-600">{fmtNum(summary.ok_requests)} ok</span> · <span className="text-red-600">{fmtNum(summary.error_requests)} err</span></span> },
                { label: "Total cost", value: fc(summary.total_cost_usd), sub: summary.total_requests > 0 ? `avg ${fc(summary.avg_cost_per_request, 6)} / req` : "—" },
                { label: "Avg latency", value: fmtMs(summary.avg_latency_ms), sub: null },
                { label: "Avg TTFB", value: fmtMs(summary.avg_ttfb_ms), sub: null },
                { label: "Total tokens", value: fmtNum(summary.total_tokens), sub: <span>{fmtNum(summary.total_prompt_tokens)} prompt · {fmtNum(summary.total_completion_tokens)} completion</span> },
                { label: "Error rate", value: summary.error_rate.toFixed(2) + "%", sub: `${fmtNum(summary.error_requests)} errors` },
              ].map((cell, i) => (
                <div key={i} className="flex flex-col gap-1 px-4 py-3 border-r border-border last:border-r-0">
                  <div className="text-[10px] uppercase tracking-wide text-muted-foreground">{cell.label}</div>
                  <div className="text-[18px] font-semibold tabular-nums leading-none">{cell.value}</div>
                  {cell.sub && <div className="text-[10.5px] text-muted-foreground">{cell.sub}</div>}
                </div>
              ))}
            </div>
          )}
        </Card>

        {/* Table - CSS Grid for consistent row heights */}
        <Card className="overflow-hidden">
          <div className="overflow-x-auto">
            <div className="min-w-[1080px]">
              {/* Header Row - CSS Grid */}
              <div className="grid grid-cols-[140px_100px_180px_70px_80px_70px_80px_160px_70px_32px] border-b border-border bg-muted/40 text-muted-foreground text-xs">
                {["Date / Time", "Provider", "Model", "Status", "Cost", "Prompt", "Completion", "Latency", "TTFB", ""].map((h, i) => (
                  <div key={i} className={`px-3 py-2.5 text-left font-medium text-[10.5px] uppercase tracking-wider flex items-center ${["Cost", "Prompt", "Completion", "TTFB"].includes(h) ? "text-right justify-end" : ""}`}>
                    {h}
                  </div>
                ))}
              </div>

              {/* Body Rows - CSS Grid */}
              <div className="divide-y divide-border">
                {loading ? Array.from({ length: 10 }).map((_, i) => (
                  <div key={i} className="grid grid-cols-[140px_100px_180px_70px_80px_70px_80px_160px_70px_32px] text-xs">
                    <div className="px-3 py-2 col-span-10"><Skeleton className="h-4" /></div>
                  </div>
                )) : items.length === 0 ? (
                  <div className="grid grid-cols-1 px-4 py-10 text-center text-muted-foreground">
                    <ScrollText size={22} className="mx-auto mb-2 opacity-50" />
                    <div className="text-sm font-medium text-foreground">No requests match</div>
                    <div className="text-[11px] mt-0.5">Try clearing filters or widening the date range.</div>
                  </div>
                ) : items.map((log) => (
                  <div key={log.id} onClick={() => openDetail(log)}
                    className="group cursor-pointer hover:bg-muted/40 transition-colors grid grid-cols-[140px_100px_180px_70px_80px_70px_80px_160px_70px_32px] text-xs">
                    <div className="px-3 py-2.5 font-mono text-[11px] text-muted-foreground whitespace-nowrap tabular-nums flex items-center">{fmtDateTimeShort(log.created_at)}</div>
                    <div className="px-3 py-2.5 flex items-center">
                      <div className="inline-flex items-center gap-1.5">
                        <span className="h-2 w-2 rounded-sm shrink-0" style={{ background: log.provider_color === "violet" ? "oklch(0.55 0.19 290)" : log.provider_color === "teal" ? "oklch(0.60 0.12 195)" : log.provider_color === "amber" ? "oklch(0.72 0.15 70)" : "oklch(0.55 0.01 260)" }} />
                        <span className="font-medium whitespace-nowrap">{log.provider_name}</span>
                      </div>
                    </div>
                    <div className="px-3 py-2.5 font-mono text-[11px] truncate flex items-center" title={log.model_used}>{log.model_used}</div>
                    <div className="px-3 py-2.5 flex items-center"><StatusBadge status={log.status_code} /></div>
                    <div className="px-3 py-2.5 font-mono tabular-nums text-right whitespace-nowrap flex items-center justify-end">{log.cost_usd > 0 ? fc(log.cost_usd, 4) : <span className="text-muted-foreground">–</span>}</div>
                    <div className="px-3 py-2.5 font-mono tabular-nums text-right text-muted-foreground whitespace-nowrap flex items-center justify-end">{fmtNum(log.prompt_tokens)}</div>
                    <div className="px-3 py-2.5 font-mono tabular-nums text-right text-muted-foreground whitespace-nowrap flex items-center justify-end">{fmtNum(log.completion_tokens)}</div>
                    <div className="px-3 py-2.5 min-w-[160px] flex items-center"><LatencyBar ms={log.latency_ms} /></div>
                    <div className="px-3 py-2.5 font-mono tabular-nums text-right text-muted-foreground whitespace-nowrap flex items-center justify-end">{fmtMs(log.ttfb_ms)}</div>
                    <div className="px-3 py-2.5 flex items-center justify-center"><ChevronRight size={13} className="text-muted-foreground opacity-0 group-hover:opacity-100" /></div>
                  </div>
                ))}
              </div>
            </div>
          </div>

          {/* Pagination */}
          <div className="flex flex-wrap items-center justify-between gap-3 border-t border-border px-4 py-2.5 text-xs">
            <div className="flex items-center gap-3">
              <div className="text-muted-foreground tabular-nums">
                Showing <span className="font-medium text-foreground">{total === 0 ? 0 : (page - 1) * perPage + 1}–{Math.min(page * perPage, total)}</span> of <span className="font-medium text-foreground">{total.toLocaleString()}</span>
              </div>
              <div className="h-4 w-px bg-border" />
              <div className="flex items-center gap-1.5">
                <span className="text-muted-foreground">Rows</span>
                <Select value={String(perPage)} onChange={(v) => { setPerPage(parseInt(v)); setPage(1); }}
                  options={[{ value: "20", label: "20" }, { value: "50", label: "50" }, { value: "100", label: "100" }, { value: "200", label: "200" }]}
                  className="w-[80px]" />
              </div>
            </div>
            <div className="flex items-center gap-1">
              <button className="h-7 w-7 inline-flex items-center justify-center rounded border border-border text-xs hover:bg-muted disabled:opacity-40" disabled={page === 1} onClick={() => setPage(1)}><ChevronsLeft size={12} /></button>
              <button className="h-7 w-7 inline-flex items-center justify-center rounded border border-border text-xs hover:bg-muted disabled:opacity-40" disabled={page === 1} onClick={() => setPage(page - 1)}><ChevronLeft size={12} /></button>
              <PageNumbers page={page} totalPages={totalPages} onChange={setPage} />
              <button className="h-7 w-7 inline-flex items-center justify-center rounded border border-border text-xs hover:bg-muted disabled:opacity-40" disabled={page >= totalPages} onClick={() => setPage(page + 1)}><ChevronRight size={12} /></button>
              <button className="h-7 w-7 inline-flex items-center justify-center rounded border border-border text-xs hover:bg-muted disabled:opacity-40" disabled={page >= totalPages} onClick={() => setPage(totalPages)}><ChevronsRight size={12} /></button>
            </div>
          </div>
        </Card>
      </div>

      <LogDetailDialog log={selected} open={detailOpen} onOpenChange={setDetailOpen} settings={settings} />
    </>
  );
}
