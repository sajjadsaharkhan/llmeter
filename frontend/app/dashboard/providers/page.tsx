"use client";
import { useState, useEffect, useRef } from "react";
import { Plus, MoreHorizontal, Key, Check, X, Zap, AlertTriangle, Power, Trash, ChevronRight, CheckCircle, XCircle, Clock } from "lucide-react";
import { Topbar } from "@/components/shell/Sidebar";
import { Card, CardHeader, CardTitle, CardDescription, CardContent, Badge, Switch, Sheet, Dialog, Input, Label, Separator, InfoTip, Skeleton, useToast } from "@/components/ui";
import { api, type Provider, type ProviderCreate, type ModelMapping } from "@/lib/api";
import { fmtNum, fmtMs } from "@/lib/utils";

const COLORS = ["violet", "teal", "amber", "sky", "rose", "zinc"];
const PROVIDER_COLORS: Record<string, string> = {
  violet: "oklch(0.55 0.19 290)", teal: "oklch(0.60 0.12 195)",
  amber: "oklch(0.72 0.15 70)", sky: "oklch(0.60 0.14 230)",
  rose: "oklch(0.60 0.18 15)", zinc: "oklch(0.55 0.01 260)",
};

// Pricing reference for well-known models (USD per 1M tokens)
const MODEL_PRICING: Record<string, { cost_input: number; cost_cache: number; cost_output: number }> = {
  "gpt-4o": { cost_input: 2.5, cost_cache: 1.25, cost_output: 10.0 },
  "gpt-4o-mini": { cost_input: 0.15, cost_cache: 0.075, cost_output: 0.60 },
  "gpt-4o-2024-11-20": { cost_input: 2.5, cost_cache: 1.25, cost_output: 10.0 },
  "gpt-4-turbo": { cost_input: 10.0, cost_cache: 5.0, cost_output: 30.0 },
  "gpt-3.5-turbo": { cost_input: 0.5, cost_cache: 0.25, cost_output: 1.5 },
  "o1": { cost_input: 15.0, cost_cache: 7.5, cost_output: 60.0 },
  "o1-mini": { cost_input: 3.0, cost_cache: 1.5, cost_output: 12.0 },
  "o3-mini": { cost_input: 1.1, cost_cache: 0.55, cost_output: 4.4 },
  "claude-opus-4-5": { cost_input: 15.0, cost_cache: 1.5, cost_output: 75.0 },
  "claude-sonnet-4-5": { cost_input: 3.0, cost_cache: 0.3, cost_output: 15.0 },
  "claude-haiku-4-5": { cost_input: 0.8, cost_cache: 0.08, cost_output: 4.0 },
  "claude-3-5-sonnet-20241022": { cost_input: 3.0, cost_cache: 0.3, cost_output: 15.0 },
  "claude-3-5-haiku-20241022": { cost_input: 0.8, cost_cache: 0.08, cost_output: 4.0 },
  "claude-3-opus-20240229": { cost_input: 15.0, cost_cache: 1.5, cost_output: 75.0 },
  "claude-3-haiku-20240307": { cost_input: 0.25, cost_cache: 0.03, cost_output: 1.25 },
  "gemini-2.0-flash": { cost_input: 0.1, cost_cache: 0.025, cost_output: 0.4 },
  "gemini-1.5-pro": { cost_input: 1.25, cost_cache: 0.3125, cost_output: 5.0 },
  "gemini-1.5-flash": { cost_input: 0.075, cost_cache: 0.01875, cost_output: 0.3 },
  "llama-3.1-405b-instruct": { cost_input: 3.0, cost_cache: 0, cost_output: 3.0 },
  "llama-3.1-70b-instruct": { cost_input: 0.9, cost_cache: 0, cost_output: 0.9 },
  "llama-3.1-8b-instruct": { cost_input: 0.2, cost_cache: 0, cost_output: 0.2 },
  "deepseek-chat": { cost_input: 0.14, cost_cache: 0.014, cost_output: 0.28 },
  "deepseek-reasoner": { cost_input: 0.55, cost_cache: 0.14, cost_output: 2.19 },
};

interface AliasRow {
  from: string;
  target: string;
  cost_input: number;
  cost_cache: number;
  cost_output: number;
}

function emptyAlias(): AliasRow {
  return { from: "", target: "", cost_input: 0, cost_cache: 0, cost_output: 0 };
}

function aliasesToRows(aliases: Record<string, ModelMapping | string>): AliasRow[] {
  return Object.entries(aliases || {}).map(([from, config]) => {
    if (typeof config === "string") {
      return { from, target: config, cost_input: 0, cost_cache: 0, cost_output: 0 };
    }
    return {
      from,
      target: config.target || "",
      cost_input: config.cost_input_per_1m ?? 0,
      cost_cache: config.cost_cache_per_1m ?? 0,
      cost_output: config.cost_output_per_1m ?? 0,
    };
  });
}

function rowsToAliases(rows: AliasRow[]): Record<string, ModelMapping> {
  return Object.fromEntries(
    rows
      .filter((r) => r.from.trim())
      .map((r) => [
        r.from,
        {
          ...(r.target.trim() ? { target: r.target } : {}),
          cost_input_per_1m: r.cost_input,
          cost_cache_per_1m: r.cost_cache,
          cost_output_per_1m: r.cost_output,
        } as ModelMapping,
      ])
  );
}

function ModelCombobox({
  value, onChange, models, onSelect, placeholder,
}: {
  value: string; onChange: (v: string) => void;
  models: string[]; onSelect: (model: string) => void; placeholder?: string;
}) {
  const [open, setOpen] = useState(false);
  const ref = useRef<HTMLDivElement>(null);
  const filtered = models
    .filter((m) => !value || m.toLowerCase().includes(value.toLowerCase()))
    .slice(0, 24);

  useEffect(() => {
    const handler = (e: MouseEvent) => {
      if (ref.current && !ref.current.contains(e.target as Node)) setOpen(false);
    };
    document.addEventListener("mousedown", handler);
    return () => document.removeEventListener("mousedown", handler);
  }, []);

  return (
    <div className="relative" ref={ref}>
      <Input
        value={value}
        onChange={(e) => { onChange(e.target.value); setOpen(true); }}
        onFocus={() => setOpen(true)}
        className="h-7 text-xs font-mono"
        placeholder={placeholder || "model name"}
      />
      {open && filtered.length > 0 && (
        <div className="absolute top-full left-0 right-0 z-50 mt-0.5 max-h-[200px] overflow-y-auto rounded-md border border-border bg-popover shadow-lg">
          {filtered.map((m) => (
            <button key={m} onMouseDown={(e) => { e.preventDefault(); onSelect(m); onChange(m); setOpen(false); }}
              className="flex w-full items-center justify-between px-2.5 py-1.5 text-left text-xs font-mono hover:bg-muted">
              <span className="truncate">{m}</span>
              {MODEL_PRICING[m] && <span className="ml-2 text-[10px] text-emerald-600 shrink-0">${MODEL_PRICING[m].cost_input}</span>}
            </button>
          ))}
        </div>
      )}
    </div>
  );
}

function LoadBalancerBar({ providers }: { providers: Provider[] }) {
  const active = providers.filter((p) => p.is_active && p.weight > 0);
  const total = active.reduce((s, p) => s + p.weight, 0) || 1;
  const [hover, setHover] = useState<number | null>(null);

  if (!active.length) {
    return <div className="h-14 rounded-lg border border-border flex items-center justify-center text-sm text-muted-foreground">No active providers with weight &gt; 0</div>;
  }

  return (
    <div className="flex flex-col gap-4">
      <div className="flex h-14 w-full rounded-lg overflow-hidden border border-border">
        {active.map((p) => {
          const pct = (p.weight / total) * 100;
          const color = PROVIDER_COLORS[p.color] || PROVIDER_COLORS.zinc;
          return (
            <div key={p.id}
              onMouseEnter={() => setHover(p.id)} onMouseLeave={() => setHover(null)}
              className="relative flex items-center justify-center transition-all cursor-pointer"
              style={{ width: `${pct}%`, background: color, opacity: hover !== null && hover !== p.id ? 0.35 : 1 }}>
              <div className="flex flex-col items-center text-white px-2">
                <span className="text-[11px] font-semibold leading-none truncate max-w-full">{p.name}</span>
                <span className="text-[10px] font-mono opacity-80 mt-0.5">{pct.toFixed(0)}%</span>
              </div>
              {hover === p.id && (
                <div className="absolute bottom-[calc(100%+8px)] left-1/2 -translate-x-1/2 z-20 rounded-md border border-border bg-popover px-2.5 py-1.5 shadow-lg whitespace-nowrap">
                  <div className="text-[11px] font-semibold">{p.name}</div>
                  <div className="text-[10px] text-muted-foreground">{pct.toFixed(0)}% of traffic</div>
                </div>
              )}
            </div>
          );
        })}
      </div>
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-2">
        {active.map((p) => {
          const pct = (p.weight / total) * 100;
          const color = PROVIDER_COLORS[p.color] || PROVIDER_COLORS.zinc;
          return (
            <div key={p.id}
              onMouseEnter={() => setHover(p.id)} onMouseLeave={() => setHover(null)}
              className={`flex items-center gap-2.5 p-2 rounded-md transition-all ${hover === p.id ? "bg-muted" : ""}`}>
              <span className="h-3 w-3 rounded-sm shrink-0" style={{ background: color }} />
              <div className="min-w-0 flex-1 text-xs font-medium truncate">{p.name}</div>
              <div className="text-sm font-semibold tabular-nums">{pct.toFixed(0)}%</div>
            </div>
          );
        })}
      </div>
    </div>
  );
}

function TestStatusBadge({ p }: { p: Provider }) {
  if (p.last_test_at == null) {
    return (
      <div className="flex items-center gap-2 rounded-md border border-border bg-muted/30 px-3 py-2 mt-3">
        <div className="h-2 w-2 rounded-full bg-muted-foreground/30 shrink-0" />
        <span className="text-[11px] text-muted-foreground">Not tested yet</span>
      </div>
    );
  }
  const ago = Math.round((Date.now() - new Date(p.last_test_at).getTime()) / 60000);
  const agoStr = ago < 1 ? "just now" : ago < 60 ? `${ago}m ago` : `${Math.round(ago / 60)}h ago`;
  return (
    <div className={`flex items-start gap-2.5 rounded-md border px-3 py-2.5 mt-3 ${
      p.last_test_ok ? "border-emerald-500/30 bg-emerald-500/5" : "border-red-500/30 bg-red-500/5"
    }`}>
      {p.last_test_ok
        ? <CheckCircle size={14} className="text-emerald-600 mt-0.5 shrink-0" />
        : <XCircle size={14} className="text-red-500 mt-0.5 shrink-0" />}
      <div className="min-w-0 flex-1">
        <div className={`text-xs font-semibold ${p.last_test_ok ? "text-emerald-700 dark:text-emerald-400" : "text-red-700 dark:text-red-400"}`}>
          {p.last_test_ok ? "Connected" : "Connection failed"}
          {p.last_test_latency_ms != null && p.last_test_ok && (
            <span className="ml-1.5 font-mono text-muted-foreground font-normal">{p.last_test_latency_ms}ms</span>
          )}
        </div>
        <div className="text-[10.5px] text-muted-foreground mt-0.5 truncate">{p.last_test_message}</div>
        <div className="text-[10px] text-muted-foreground mt-0.5">{agoStr}</div>
      </div>
    </div>
  );
}

function ProviderCard({
  p, onEdit, onToggle, totalWeight,
}: {
  p: Provider; onEdit: (p: Provider) => void; onToggle: (p: Provider) => void; totalWeight: number;
}) {
  const color = PROVIDER_COLORS[p.color] || PROVIDER_COLORS.zinc;
  const effectivePct = p.is_active && p.weight > 0 ? Math.round((p.weight / totalWeight) * 100) : 0;

  return (
    <Card className="hover:shadow-md transition-shadow">
      <div className="p-5">
        <div className="flex items-start justify-between mb-4 gap-3">
          <div className="flex items-center gap-2.5 min-w-0">
            <span className="h-2.5 w-2.5 rounded-full shrink-0" style={{ background: color }} />
            <div className="min-w-0">
              <div className="flex items-center gap-2">
                <h3 className="text-sm font-semibold truncate">{p.name}</h3>
                {!p.is_active && <Badge variant="outline">disabled</Badge>}
                {p.is_active && p.weight > 0 && <Badge variant="success"><span className="h-2 w-2 rounded-full bg-emerald-500 inline-block" />active</Badge>}
              </div>
              <div className="text-[11px] text-muted-foreground font-mono truncate mt-0.5">{p.base_url}</div>
            </div>
          </div>
          <div className="flex items-center gap-1 shrink-0">
            <Switch checked={p.is_active} onCheckedChange={() => onToggle(p)} />
            <button onClick={() => onEdit(p)} className="h-8 w-8 inline-flex items-center justify-center rounded-md hover:bg-muted text-muted-foreground hover:text-foreground">
              <MoreHorizontal size={15} />
            </button>
          </div>
        </div>

        <div className="flex items-center gap-1.5 rounded-md border border-border bg-muted/40 px-2.5 py-1.5 mb-4">
          <Key size={11} className="text-muted-foreground" />
          <code className="text-[11px] font-mono text-muted-foreground truncate flex-1">{p.key_mask}</code>
        </div>

        <div className="flex items-center justify-between rounded-md border border-border bg-muted/30 px-3 py-2 mb-3">
          <span className="text-[10px] text-muted-foreground uppercase tracking-wide">Traffic share</span>
          <span className="text-sm font-semibold tabular-nums">{p.is_active && p.weight > 0 ? `${effectivePct}%` : <span className="text-muted-foreground">—</span>}</span>
        </div>

        <div className="h-1 w-full rounded-full bg-muted overflow-hidden mb-3">
          <div className="h-full transition-all" style={{ width: `${effectivePct}%`, background: color }} />
        </div>

        <TestStatusBadge p={p} />
      </div>
    </Card>
  );
}

interface TestState { status: "idle" | "loading" | "ok" | "error"; message: string | null; latency: number | null; }

function ProviderSheet({ provider, open, onOpenChange, onSave, onDelete, allProviders }: {
  provider: Provider | null; open: boolean; onOpenChange: (v: boolean) => void;
  onSave: (data: ProviderCreate & { id?: number }) => void;
  onDelete: (id: number) => void;
  allProviders: Provider[];
}) {
  const [form, setForm] = useState<ProviderCreate>({ name: "", base_url: "", api_key: "", weight: 50, is_active: true });
  const [showKey, setShowKey] = useState(false);
  const [test, setTest] = useState<TestState>({ status: "idle", message: null, latency: null });
  const [aliases, setAliases] = useState<AliasRow[]>([]);
  const [providerModels, setProviderModels] = useState<string[]>([]);
  const [confirmDelete, setConfirmDelete] = useState(false);
  const [deleteInput, setDeleteInput] = useState("");
  const isEdit = !!provider;
  const toast = useToast();

  // All known model names for the combobox
  const allModels = Array.from(new Set([...Object.keys(MODEL_PRICING), ...providerModels])).sort();

  useEffect(() => {
    if (!open) { setConfirmDelete(false); setDeleteInput(""); return; }
    if (provider) {
      setForm({ name: provider.name, base_url: provider.base_url, api_key: "", weight: provider.weight, is_active: provider.is_active });
      setAliases(aliasesToRows(provider.model_aliases || {}));
      // Fetch models from provider
      api.getProviderModels(provider.id).then((r) => setProviderModels(r.models)).catch(() => {});
    } else {
      setForm({ name: "", base_url: "", api_key: "", weight: 50, is_active: true });
      setAliases([]);
      setProviderModels([]);
    }
    setTest({ status: "idle", message: null, latency: null });
  }, [provider, open]);

  const editingId = provider?.id ?? -1;
  const otherActiveWeight = allProviders.filter((p) => p.is_active && p.id !== editingId && p.weight > 0).reduce((s, p) => s + p.weight, 0);
  const thisWeight = form.is_active ? (form.weight ?? 0) : 0;
  const totalWeight = otherActiveWeight + thisWeight;
  const sharePct = totalWeight > 0 && form.is_active ? (thisWeight / totalWeight) * 100 : 0;
  const isSoleActive = form.is_active && otherActiveWeight === 0;

  const updateAlias = (i: number, patch: Partial<AliasRow>) => {
    const next = [...aliases];
    next[i] = { ...next[i], ...patch };
    setAliases(next);
  };

  const applyModelPricing = (i: number, modelName: string) => {
    const pricing = MODEL_PRICING[modelName];
    if (pricing) {
      updateAlias(i, { cost_input: pricing.cost_input, cost_cache: pricing.cost_cache, cost_output: pricing.cost_output });
    }
  };

  const runTest = async () => {
    if (!provider) return;
    setTest({ status: "loading", message: null, latency: null });
    try {
      const res = await api.testProvider(provider.id);
      setTest({ status: res.ok ? "ok" : "error", message: res.message, latency: res.latency_ms ?? null });
      if (res.ok) {
        api.getProviderModels(provider.id).then((r) => setProviderModels(r.models)).catch(() => {});
      }
    } catch (e: unknown) {
      setTest({ status: "error", message: e instanceof Error ? e.message : "Connection failed", latency: null });
    }
  };

  const handleSave = () => {
    onSave({ ...form, id: provider?.id, model_aliases: rowsToAliases(aliases) });
    onOpenChange(false);
  };

  const handleDelete = () => {
    if (!provider) return;
    onDelete(provider.id);
    onOpenChange(false);
    setConfirmDelete(false);
  };

  const MATH_PROBLEM = provider ? `${provider.id * 7 + 13} + ${provider.id * 3}` : "";
  const MATH_ANSWER = provider ? String(provider.id * 7 + 13 + provider.id * 3) : "";
  const deleteReady = deleteInput.trim() === MATH_ANSWER;

  return (
    <Sheet open={open} onOpenChange={onOpenChange} widthClass="w-[520px]">
      <div className="flex h-14 items-center justify-between border-b border-border px-5">
        <div>
          <div className="text-sm font-semibold">{isEdit ? "Edit provider" : "Add provider"}</div>
          <div className="text-[11px] text-muted-foreground">{isEdit ? "Update credentials, model pricing, and routing" : "Connect a new upstream LLM provider"}</div>
        </div>
        <button onClick={() => onOpenChange(false)} className="h-8 w-8 inline-flex items-center justify-center rounded-md hover:bg-muted"><X size={16} /></button>
      </div>

      {confirmDelete ? (
        <div className="flex-1 flex flex-col p-5 gap-4">
          <div className="flex items-start gap-3 rounded-md border border-red-500/30 bg-red-500/5 p-4">
            <AlertTriangle size={16} className="text-red-500 mt-0.5 shrink-0" />
            <div>
              <div className="text-sm font-semibold text-red-700 dark:text-red-400">Delete {provider?.name}?</div>
              <p className="text-xs text-muted-foreground mt-1">This permanently removes the provider and all its configuration. Requests using this provider will fail. This cannot be undone.</p>
            </div>
          </div>
          <div className="flex flex-col gap-1.5">
            <Label>Solve to confirm: <span className="font-mono text-foreground font-semibold">{MATH_PROBLEM} = ?</span></Label>
            <Input value={deleteInput} onChange={(e) => setDeleteInput(e.target.value)} placeholder="Enter the answer" className="font-mono" autoFocus />
          </div>
          <div className="flex gap-2 mt-2">
            <button onClick={() => { setConfirmDelete(false); setDeleteInput(""); }}
              className="flex-1 h-9 rounded-md border border-border text-sm font-medium hover:bg-muted">Cancel</button>
            <button onClick={handleDelete} disabled={!deleteReady}
              className="flex-1 inline-flex items-center justify-center gap-2 h-9 rounded-md bg-red-600 text-white text-sm font-medium hover:bg-red-700 disabled:opacity-40 disabled:cursor-not-allowed transition-colors">
              <Trash size={13} />Delete provider
            </button>
          </div>
        </div>
      ) : (
        <>
          <div className="flex-1 overflow-y-auto px-5 py-5 flex flex-col gap-5">
            <div className="flex flex-col gap-1.5">
              <Label>Display name</Label>
              <Input value={form.name} onChange={(e) => setForm({ ...form, name: e.target.value })} placeholder="AvalAI" />
            </div>

            <div className="flex flex-col gap-1.5">
              <Label>Base URL</Label>
              <Input value={form.base_url} onChange={(e) => setForm({ ...form, base_url: e.target.value })} placeholder="https://api.avalai.ir/v1" className="font-mono text-xs" />
              <p className="text-[10.5px] text-muted-foreground">OpenAI-compatible endpoint. LLMeter appends <code className="font-mono">/chat/completions</code>.</p>
            </div>

            <div className="flex flex-col gap-1.5">
              <Label>API key {isEdit && <span className="text-muted-foreground font-normal">(leave blank to keep)</span>}</Label>
              <div className="relative">
                <Input type={showKey ? "text" : "password"} value={form.api_key} onChange={(e) => setForm({ ...form, api_key: e.target.value })}
                  placeholder={isEdit ? provider?.key_mask : "sk-..."} className="pr-16 font-mono text-xs" />
                <button type="button" onClick={() => setShowKey(!showKey)}
                  className="absolute right-2 top-1/2 -translate-y-1/2 text-xs text-muted-foreground hover:text-foreground">
                  {showKey ? "Hide" : "Show"}
                </button>
              </div>
            </div>

            {isEdit && (
              <div className="flex items-center gap-2 flex-wrap -mt-2">
                <button onClick={runTest} disabled={test.status === "loading"}
                  className="inline-flex items-center gap-1.5 h-8 px-3 rounded-md border border-border text-xs font-medium hover:bg-muted disabled:opacity-50">
                  {test.status === "loading" ? <><svg className="animate-spin" width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5"><path d="M21 12a9 9 0 1 1-6.22-8.56" /></svg>Testing…</> : <><Zap size={12} />Test connection</>}
                </button>
                {test.status === "ok" && <span className="inline-flex items-center gap-1.5 text-[11px] text-emerald-600 font-medium"><Check size={12} />{test.message}{test.latency != null && <span className="text-muted-foreground font-mono">· {test.latency}ms</span>}</span>}
                {test.status === "error" && <span className="inline-flex items-center gap-1.5 text-[11px] text-red-600 font-medium"><AlertTriangle size={12} />{test.message}</span>}
              </div>
            )}

            <Separator />

            {/* Model mappings */}
            {(() => {
              const mappingEnabled = isEdit && (provider?.last_test_ok === true || test.status === "ok");
              return (
                <div>
                  <div className="mb-2 flex items-center gap-1.5">
                    <Label>Model mappings</Label>
                    <InfoTip>
                      <div className="flex flex-col gap-1.5">
                        <div className="font-semibold">Per-model pricing & aliasing</div>
                        <div>Set the model name your app sends (left) and the actual model at the provider (right). Selecting a known model auto-fills pricing. Requires a successful connection test.</div>
                      </div>
                    </InfoTip>
                  </div>
                  {!mappingEnabled ? (
                    <div className="flex items-start gap-3 rounded-md border border-border bg-muted/30 p-4">
                      <Zap size={14} className="text-muted-foreground mt-0.5 shrink-0" />
                      <div>
                        <div className="text-xs font-medium text-muted-foreground">
                          {!isEdit
                            ? "Save the provider first, then run a successful connection test to configure model mappings."
                            : "Run a successful connection test above to unlock model mappings."}
                        </div>
                      </div>
                    </div>
                  ) : (
                    <div className="rounded-md border border-border divide-y divide-border">
                      {aliases.map((alias, i) => (
                        <div key={i} className="p-3 flex flex-col gap-2">
                          <div className="grid grid-cols-[1fr_auto_1fr_auto] items-center gap-2">
                            <ModelCombobox
                              value={alias.from}
                              onChange={(v) => updateAlias(i, { from: v })}
                              models={allModels}
                              onSelect={(m) => { updateAlias(i, { from: m }); applyModelPricing(i, m); }}
                              placeholder="requested model"
                            />
                            <ChevronRight size={12} className="text-muted-foreground shrink-0" />
                            <ModelCombobox
                              value={alias.target}
                              onChange={(v) => updateAlias(i, { target: v })}
                              models={providerModels.length > 0 ? providerModels : allModels}
                              onSelect={(m) => { updateAlias(i, { target: m }); applyModelPricing(i, m); }}
                              placeholder="provider model"
                            />
                            <button onClick={() => setAliases(aliases.filter((_, j) => j !== i))}
                              className="h-7 w-7 inline-flex items-center justify-center rounded hover:bg-muted text-muted-foreground">
                              <X size={12} />
                            </button>
                          </div>
                          <div className="grid grid-cols-3 gap-2">
                            {[
                              { label: "Input /1M", key: "cost_input" as const },
                              { label: "Cache /1M", key: "cost_cache" as const },
                              { label: "Output /1M", key: "cost_output" as const },
                            ].map((f) => (
                              <div key={f.key}>
                                <div className="text-[9px] text-muted-foreground uppercase tracking-wide mb-0.5">{f.label}</div>
                                <div className="relative">
                                  <span className="absolute left-2 top-1/2 -translate-y-1/2 text-[10px] text-muted-foreground">$</span>
                                  <Input type="number" step="0.001" min="0" value={alias[f.key]}
                                    onChange={(e) => updateAlias(i, { [f.key]: parseFloat(e.target.value) || 0 })}
                                    className="h-7 pl-4 text-xs font-mono" />
                                </div>
                              </div>
                            ))}
                          </div>
                        </div>
                      ))}
                      <button onClick={() => setAliases([...aliases, emptyAlias()])}
                        className="flex w-full items-center justify-center gap-1.5 px-2.5 py-2.5 text-xs text-muted-foreground hover:text-foreground hover:bg-muted">
                        <Plus size={12} />Add model mapping
                      </button>
                    </div>
                  )}
                </div>
              );
            })()}

            <Separator />

            {/* Routing weight */}
            <div>
              <div className="flex items-baseline justify-between mb-2">
                <div className="flex items-center gap-1.5">
                  <Label>Routing weight</Label>
                  <InfoTip>Weighted random routing. Share = this weight ÷ sum of all active weights. Set 0 for failover-only.</InfoTip>
                </div>
                <div className="text-xs font-mono tabular-nums">
                  {isSoleActive
                    ? <span className="text-emerald-600 font-semibold">100% — sole active provider</span>
                    : <><span className="font-semibold">{form.weight}</span><span className="text-muted-foreground ml-2">≈ {sharePct.toFixed(0)}%</span></>}
                </div>
              </div>
              <input type="range" min="0" max="100" value={form.weight} disabled={isSoleActive}
                onChange={(e) => setForm({ ...form, weight: parseInt(e.target.value) })}
                className="w-full disabled:opacity-40" />
            </div>

            <div className="flex items-center justify-between rounded-md border border-border px-3 py-2.5">
              <div>
                <div className="text-xs font-medium">Enable provider</div>
                <div className="text-[10.5px] text-muted-foreground">Disabled providers won't receive traffic</div>
              </div>
              <Switch checked={form.is_active} onCheckedChange={(v) => setForm({ ...form, is_active: v })} />
            </div>
          </div>

          <div className="flex items-center justify-between gap-2 border-t border-border p-4">
            {isEdit ? (
              <button onClick={() => setConfirmDelete(true)}
                className="inline-flex items-center gap-1.5 h-9 px-3.5 rounded-md text-sm font-medium text-red-600 hover:text-red-700 hover:bg-red-500/10 transition-colors">
                <Trash size={13} />Delete
              </button>
            ) : <div />}
            <div className="flex gap-2">
              <button onClick={() => onOpenChange(false)} className="h-9 px-3.5 rounded-md border border-border text-sm font-medium hover:bg-muted">Cancel</button>
              <button onClick={handleSave} className="inline-flex items-center gap-2 h-9 px-3.5 rounded-md bg-accent text-accent-fg text-sm font-medium hover:bg-foreground/90">
                <Check size={13} />{isEdit ? "Save changes" : "Add provider"}
              </button>
            </div>
          </div>
        </>
      )}
    </Sheet>
  );
}

export default function ProvidersPage() {
  const [providers, setProviders] = useState<Provider[]>([]);
  const [loading, setLoading] = useState(true);
  const [editing, setEditing] = useState<Provider | null>(null);
  const [sheetOpen, setSheetOpen] = useState(false);
  const [toggleTarget, setToggleTarget] = useState<Provider | null>(null);
  const toast = useToast();

  const load = async () => {
    setLoading(true);
    try { setProviders(await api.getProviders()); } catch (e) { console.error(e); }
    finally { setLoading(false); }
  };

  useEffect(() => { load(); }, []);

  const openEdit = (p: Provider) => { setEditing(p); setSheetOpen(true); };
  const openNew = () => { setEditing(null); setSheetOpen(true); };

  const save = async (data: ProviderCreate & { id?: number }) => {
    try {
      if (data.id) {
        await api.updateProvider(data.id, data);
        toast({ variant: "success", title: "Provider updated", description: data.name });
      } else {
        await api.createProvider(data);
        toast({ variant: "success", title: "Provider added", description: data.name });
      }
      load();
    } catch (e: unknown) {
      toast({ variant: "destructive", title: "Error", description: e instanceof Error ? e.message : "Failed" });
    }
  };

  const deleteProvider = async (id: number) => {
    try {
      await api.deleteProvider(id);
      toast({ variant: "success", title: "Provider deleted" });
      load();
    } catch (e: unknown) {
      toast({ variant: "destructive", title: "Error", description: e instanceof Error ? e.message : "Failed" });
    }
  };

  const confirmToggle = async () => {
    if (!toggleTarget) return;
    try {
      await api.updateProvider(toggleTarget.id, { is_active: !toggleTarget.is_active });
      toast({ variant: "success", title: `${toggleTarget.name} ${toggleTarget.is_active ? "disabled" : "enabled"}` });
      load();
    } catch { toast({ variant: "destructive", title: "Error" }); }
    setToggleTarget(null);
  };

  const activeProviders = providers.filter((p) => p.is_active && p.weight > 0);
  const totalWeight = activeProviders.reduce((s, p) => s + p.weight, 0) || 1;

  return (
    <>
      <Topbar title="Providers" subtitle={`${providers.filter((p) => p.is_active).length} active · ${providers.length} total`}
        right={<button onClick={openNew} className="inline-flex items-center gap-2 h-9 px-3.5 rounded-md bg-accent text-accent-fg text-sm font-medium hover:bg-foreground/90"><Plus size={13} />Add provider</button>}
      />
      <div className="p-4 md:p-6 flex flex-col gap-5 max-w-[1400px]">
        <Card>
          <CardHeader>
            <div className="flex items-baseline justify-between">
              <div>
                <div className="flex items-center gap-1.5">
                  <CardTitle>Load balancer</CardTitle>
                  <InfoTip>Traffic distribution proportional to each provider's weight. Sums to 100% across active providers.</InfoTip>
                </div>
                <CardDescription>Traffic distribution across active providers</CardDescription>
              </div>
              <Badge variant="success"><span className="h-2 w-2 rounded-full bg-emerald-500 inline-block" />routing live</Badge>
            </div>
          </CardHeader>
          <CardContent>
            {loading ? <Skeleton className="h-[100px]" /> : <LoadBalancerBar providers={providers} />}
          </CardContent>
        </Card>

        <div>
          <div className="mb-3 flex items-baseline justify-between">
            <h2 className="text-sm font-semibold">Configured providers</h2>
            <span className="text-xs text-muted-foreground">{providers.length} total</span>
          </div>
          {loading ? (
            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-3">
              {Array.from({ length: 4 }).map((_, i) => <Skeleton key={i} className="h-[160px]" />)}
            </div>
          ) : providers.length === 0 ? (
            <div className="flex flex-col items-center justify-center py-16 text-center">
              <Server className="mx-auto mb-3 opacity-30" size={32} />
              <div className="text-sm font-medium">No providers yet</div>
              <div className="text-xs text-muted-foreground mt-1">Add your first LLM provider to start routing requests.</div>
              <button onClick={openNew} className="mt-4 inline-flex items-center gap-2 h-9 px-3.5 rounded-md bg-accent text-accent-fg text-sm font-medium hover:bg-foreground/90"><Plus size={13} />Add provider</button>
            </div>
          ) : (
            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-3">
              {providers.map((p) => (
                <ProviderCard key={p.id} p={p} onEdit={openEdit} onToggle={(p) => setToggleTarget(p)} totalWeight={totalWeight} />
              ))}
            </div>
          )}
        </div>
      </div>

      <ProviderSheet provider={editing} open={sheetOpen} onOpenChange={setSheetOpen} onSave={save} onDelete={deleteProvider} allProviders={providers} />

      <Dialog open={!!toggleTarget} onOpenChange={(v) => !v && setToggleTarget(null)} size="sm">
        {toggleTarget && (
          <div className="p-5">
            <div className="flex items-start gap-3">
              <div className={`flex h-9 w-9 items-center justify-center rounded-full shrink-0 ${toggleTarget.is_active ? "bg-amber-500/10" : "bg-emerald-500/10"}`}>
                {toggleTarget.is_active ? <AlertTriangle size={16} className="text-amber-500" /> : <Power size={16} className="text-emerald-600" />}
              </div>
              <div className="flex-1">
                <h3 className="text-sm font-semibold">{toggleTarget.is_active ? "Disable" : "Enable"} {toggleTarget.name}?</h3>
                <p className="text-xs text-muted-foreground mt-1">
                  {toggleTarget.is_active
                    ? "Traffic currently routed here will be redistributed to the remaining active providers."
                    : "This provider will start receiving traffic based on its configured weight."}
                </p>
              </div>
            </div>
            <div className="mt-5 flex justify-end gap-2">
              <button onClick={() => setToggleTarget(null)} className="h-9 px-3.5 rounded-md border border-border text-sm font-medium hover:bg-muted">Cancel</button>
              <button onClick={confirmToggle}
                className={`inline-flex items-center gap-2 h-9 px-3.5 rounded-md text-sm font-medium ${toggleTarget.is_active ? "bg-red-600 text-white hover:bg-red-600/90" : "bg-accent text-accent-fg hover:bg-foreground/90"}`}>
                {toggleTarget.is_active ? <><Power size={13} />Disable provider</> : <><Check size={13} />Enable provider</>}
              </button>
            </div>
          </div>
        )}
      </Dialog>
    </>
  );
}

function Server(props: React.SVGProps<SVGSVGElement> & { size?: number; className?: string }) {
  return (
    <svg {...props} width={props.size || 24} height={props.size || 24} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.75" strokeLinecap="round" strokeLinejoin="round">
      <rect x="2" y="3" width="20" height="8" rx="2"/><rect x="2" y="13" width="20" height="8" rx="2"/>
      <line x1="6" y1="7" x2="6.01" y2="7"/><line x1="6" y1="17" x2="6.01" y2="17"/>
    </svg>
  );
}
