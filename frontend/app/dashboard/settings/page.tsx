"use client";
import { useState, useEffect } from "react";
import { Sun, Moon, Monitor, Check, AlertTriangle, Trash, ChevronDown } from "lucide-react";
import { Topbar } from "@/components/shell/Sidebar";
import { Card, CardContent, Input, Label, Select, Dialog, Switch, useToast, Skeleton } from "@/components/ui";
import { api, type AppSettings } from "@/lib/api";

function SectionHeader({ children }: { children: React.ReactNode }) {
  return (
    <div className="text-[10.5px] font-semibold uppercase tracking-widest text-muted-foreground px-0.5 pt-1">
      {children}
    </div>
  );
}

function CollapsibleCard({ title, description, defaultOpen = true, footer, children }: {
  title: string;
  description?: string;
  defaultOpen?: boolean;
  footer?: React.ReactNode;
  children: React.ReactNode;
}) {
  const [open, setOpen] = useState(defaultOpen);
  return (
    <Card>
      <button onClick={() => setOpen((v) => !v)}
        className="flex w-full items-start justify-between px-5 py-4 text-left">
        <div>
          <div className="text-sm font-semibold leading-tight">{title}</div>
          {description && <div className="text-xs text-muted-foreground mt-0.5">{description}</div>}
        </div>
        <ChevronDown size={15} className={`mt-0.5 shrink-0 text-muted-foreground transition-transform duration-200 ${open ? "rotate-180" : ""}`} />
      </button>
      {open && (
        <>
          <CardContent className="border-t border-border pt-4">{children}</CardContent>
          {footer && (
            <div className="flex items-center justify-end px-5 py-3 border-t border-border">
              {footer}
            </div>
          )}
        </>
      )}
    </Card>
  );
}

function SaveBtn({ onClick, label = "Save" }: { onClick: () => void; label?: string }) {
  return (
    <button onClick={onClick} className="h-9 px-3.5 rounded-md bg-accent text-accent-fg text-sm font-medium hover:bg-foreground/90 transition-colors">
      {label}
    </button>
  );
}

export default function SettingsPage() {
  const [settings, setSettings] = useState<AppSettings | null>(null);
  const [loading, setLoading] = useState(true);
  const [pwd, setPwd] = useState({ current: "", next: "", confirm: "" });
  const [proxy, setProxy] = useState({ proxy_timeout_seconds: 60, proxy_max_retries: 3, proxy_retry_backoff: "exponential" });
  const [retention, setRetention] = useState(30);
  const [currency, setCurrency] = useState({ default_currency: "USD", usd_to_toman_rate: 0 });
  const [connection, setConnection] = useState({ proxy_base_url: "", require_proxy_auth: false });
  const [theme, setTheme] = useState<"light" | "dark" | "system">("system");
  const [confirmClear, setConfirmClear] = useState(false);
  const [savingConn, setSavingConn] = useState(false);
  const toast = useToast();

  useEffect(() => {
    api.getSettings().then((s) => {
      setSettings(s);
      setProxy({ proxy_timeout_seconds: s.proxy_timeout_seconds, proxy_max_retries: s.proxy_max_retries, proxy_retry_backoff: s.proxy_retry_backoff });
      setRetention(s.log_retention_days);
      setCurrency({ default_currency: s.default_currency || "USD", usd_to_toman_rate: s.usd_to_toman_rate || 0 });
      setConnection({ proxy_base_url: s.proxy_base_url || "", require_proxy_auth: s.require_proxy_auth || false });
      setLoading(false);
    }).catch(() => setLoading(false));
    const saved = (localStorage.getItem("llmeter_theme") || "system") as "light" | "dark" | "system";
    setTheme(saved);
  }, []);

  const applyTheme = (t: "light" | "dark" | "system") => {
    setTheme(t);
    localStorage.setItem("llmeter_theme", t);
    const mode = t === "system" ? (window.matchMedia("(prefers-color-scheme: dark)").matches ? "dark" : "light") : t;
    document.documentElement.classList.toggle("dark", mode === "dark");
  };

  const saveProxy = async () => {
    try { await api.updateSettings(proxy); toast({ variant: "success", title: "Proxy settings saved" }); }
    catch (e: unknown) { toast({ variant: "destructive", title: "Error", description: e instanceof Error ? e.message : "Failed" }); }
  };

  const saveRetention = async () => {
    try { await api.updateSettings({ log_retention_days: retention }); toast({ variant: "success", title: "Retention policy updated" }); }
    catch { toast({ variant: "destructive", title: "Error" }); }
  };

  const saveCurrency = async () => {
    try { await api.updateSettings(currency); toast({ variant: "success", title: "Currency settings saved" }); }
    catch (e: unknown) { toast({ variant: "destructive", title: "Error", description: e instanceof Error ? e.message : "Failed" }); }
  };

  const saveConnection = async () => {
    setSavingConn(true);
    try {
      await api.updateSettings(connection);
      toast({ variant: "success", title: "Connection settings saved" });
    } catch (e: unknown) {
      toast({ variant: "destructive", title: "Error", description: e instanceof Error ? e.message : "Failed" });
    } finally { setSavingConn(false); }
  };

  const changePassword = async () => {
    if (pwd.next !== pwd.confirm) { toast({ variant: "destructive", title: "Passwords do not match" }); return; }
    if (pwd.next.length < 8) { toast({ variant: "destructive", title: "Password too short", description: "Minimum 8 characters" }); return; }
    try {
      await api.changePassword(pwd.current, pwd.next);
      toast({ variant: "success", title: "Password updated" });
      setPwd({ current: "", next: "", confirm: "" });
    } catch (e: unknown) { toast({ variant: "destructive", title: "Error", description: e instanceof Error ? e.message : "Failed" }); }
  };

  const clearLogs = async () => {
    try { await api.clearLogs(); toast({ variant: "success", title: "All logs cleared" }); setConfirmClear(false); }
    catch { toast({ variant: "destructive", title: "Error" }); }
  };

  return (
    <>
      <Topbar title="Settings" subtitle="Instance configuration" />

      <div className="p-4 md:p-6 max-w-[1200px] flex flex-col gap-5">

        {/* Connection — full width */}
        <SectionHeader>Connection</SectionHeader>
        <CollapsibleCard title="Proxy endpoint & auth"
          description="Public base URL and token authentication for client apps"
          footer={<button onClick={saveConnection} disabled={savingConn} className="h-9 px-3.5 rounded-md bg-accent text-accent-fg text-sm font-medium hover:bg-foreground/90 disabled:opacity-50 transition-colors">{savingConn ? "Saving…" : "Save"}</button>}>
          {loading ? <Skeleton className="h-[100px]" /> : (
            <div className="flex flex-col gap-4">
              <div className="flex flex-col gap-1.5">
                <Label>Public base URL</Label>
                <Input value={connection.proxy_base_url} onChange={(e) => setConnection({ ...connection, proxy_base_url: e.target.value })}
                  placeholder="https://llmeter.yourdomain.com" className="font-mono text-sm" />
                <p className="text-[10.5px] text-muted-foreground">Clients point their OpenAI SDK's <code className="font-mono">base_url</code> here (append <code className="font-mono">/v1</code>). Used in code examples on the Connect page.</p>
              </div>
              <div className="flex items-center justify-between rounded-md border border-border p-3">
                <div>
                  <div className="text-xs font-medium">Require token authentication</div>
                  <div className="text-[11px] text-muted-foreground mt-0.5">When enabled, all proxy requests must include a valid Bearer token. Manage tokens on the Connect page.</div>
                </div>
                <Switch checked={connection.require_proxy_auth} onCheckedChange={(v) => setConnection({ ...connection, require_proxy_auth: v })} />
              </div>
              {connection.require_proxy_auth && (
                <div className="flex items-start gap-2 rounded-md border border-amber-500/30 bg-amber-500/5 p-3 text-[11px] text-amber-700 dark:text-amber-400">
                  <AlertTriangle size={12} className="shrink-0 mt-0.5" />
                  <span>Make sure you have at least one token created on the Connect page before enabling this, or all proxy requests will be rejected.</span>
                </div>
              )}
            </div>
          )}
        </CollapsibleCard>

        {/* 2-column grid */}
        <div className="grid grid-cols-1 lg:grid-cols-2 gap-5">

          {/* Left column */}
          <div className="flex flex-col gap-5">
            <SectionHeader>Display</SectionHeader>

            <CollapsibleCard title="Appearance" description="Theme and visual preferences">
              <Label className="mb-2 block">Theme</Label>
              <div className="grid grid-cols-3 gap-2">
                {([
                  { v: "light" as const, label: "Light", icon: Sun, desc: "Bright UI" },
                  { v: "dark" as const, label: "Dark", icon: Moon, desc: "Easier at night" },
                  { v: "system" as const, label: "System", icon: Monitor, desc: "Match OS" },
                ] as const).map((opt) => {
                  const Ic = opt.icon;
                  const active = theme === opt.v;
                  return (
                    <button key={opt.v} onClick={() => applyTheme(opt.v)}
                      className={`flex flex-col items-start gap-1.5 rounded-md border p-3 text-left transition-colors ${active ? "border-foreground bg-muted/50" : "border-border hover:border-muted-foreground/40 hover:bg-muted/30"}`}>
                      <div className="flex items-center justify-between w-full">
                        <Ic size={15} className={active ? "text-foreground" : "text-muted-foreground"} />
                        {active && <Check size={13} className="text-foreground" />}
                      </div>
                      <div className="text-xs font-semibold">{opt.label}</div>
                      <div className="text-[10.5px] text-muted-foreground leading-snug">{opt.desc}</div>
                    </button>
                  );
                })}
              </div>
            </CollapsibleCard>

            <CollapsibleCard title="Currency & cost display"
              description="How costs are shown across the dashboard and logs"
              footer={<SaveBtn onClick={saveCurrency} />}>
              {loading ? <Skeleton className="h-[80px]" /> : (
                <div className="flex flex-col gap-4">
                  <div className="flex flex-col gap-1.5">
                    <Label>Default currency</Label>
                    <Select value={currency.default_currency} onChange={(v) => setCurrency({ ...currency, default_currency: v })}
                      options={[
                        { value: "USD", label: "USD — US Dollar ($)" },
                        { value: "IRT", label: "IRT — Iranian Toman (تومان)" },
                      ]} />
                  </div>
                  {currency.default_currency === "IRT" && (
                    <div className="flex flex-col gap-1.5">
                      <Label>Exchange rate <span className="text-muted-foreground font-normal">(1 USD = ? Toman)</span></Label>
                      <Input type="number" min="0" step="100"
                        value={currency.usd_to_toman_rate || ""}
                        onChange={(e) => setCurrency({ ...currency, usd_to_toman_rate: parseFloat(e.target.value) || 0 })}
                        placeholder="e.g. 65000" />
                      <p className="text-[10.5px] text-muted-foreground">
                        Costs stored in USD are multiplied by this rate for display.
                        {currency.usd_to_toman_rate > 0 && (
                          <span className="ml-1 text-foreground font-mono">$1 = {currency.usd_to_toman_rate.toLocaleString()} T</span>
                        )}
                      </p>
                    </div>
                  )}
                </div>
              )}
            </CollapsibleCard>
          </div>

          {/* Right column */}
          <div className="flex flex-col gap-5">
            <SectionHeader>Data & Proxy</SectionHeader>

            <CollapsibleCard title="Log retention"
              description="How long to keep request logs before automatic deletion"
              footer={<SaveBtn onClick={saveRetention} />}>
              <div className="flex items-baseline justify-between mb-2">
                <Label>Retain for <span className="font-mono text-foreground font-semibold">{retention} days</span></Label>
                <div className="text-[10.5px] text-muted-foreground tabular-nums">~{(retention * 0.6).toFixed(1)} GB est.</div>
              </div>
              <input type="range" min="1" max="365" value={retention} onChange={(e) => setRetention(parseInt(e.target.value))} className="w-full" />
              <div className="mt-1 flex justify-between text-[10px] font-mono text-muted-foreground">
                <span>1d</span><span>30d</span><span>90d</span><span>180d</span><span>365d</span>
              </div>
            </CollapsibleCard>

            <CollapsibleCard title="Proxy behaviour"
              description="How LLMeter forwards requests to upstream providers"
              defaultOpen={false}
              footer={<SaveBtn onClick={saveProxy} label="Save changes" />}>
              {loading ? <Skeleton className="h-[100px]" /> : (
                <div className="flex flex-col gap-4">
                  <div className="grid grid-cols-2 gap-3">
                    <div className="flex flex-col gap-1.5">
                      <Label>Request timeout (s)</Label>
                      <Input type="number" value={proxy.proxy_timeout_seconds}
                        onChange={(e) => setProxy({ ...proxy, proxy_timeout_seconds: parseInt(e.target.value) || 0 })} />
                    </div>
                    <div className="flex flex-col gap-1.5">
                      <Label>Max retries</Label>
                      <Input type="number" value={proxy.proxy_max_retries}
                        onChange={(e) => setProxy({ ...proxy, proxy_max_retries: parseInt(e.target.value) || 0 })} />
                    </div>
                  </div>
                  <div className="flex flex-col gap-1.5">
                    <Label>Retry backoff strategy</Label>
                    <Select value={proxy.proxy_retry_backoff} onChange={(v) => setProxy({ ...proxy, proxy_retry_backoff: v })}
                      options={[
                        { value: "exponential", label: "Exponential (recommended)" },
                        { value: "linear", label: "Linear" },
                        { value: "constant", label: "Constant 500ms" },
                      ]} />
                    <p className="text-[10.5px] text-muted-foreground">On 429 / 5xx, retry with the next provider by weight.</p>
                  </div>
                </div>
              )}
            </CollapsibleCard>

            <SectionHeader>Account</SectionHeader>

            <CollapsibleCard title="Change password"
              description="Update the administrator password for this instance"
              defaultOpen={false}
              footer={<SaveBtn onClick={changePassword} label="Update password" />}>
              <div className="flex flex-col gap-3">
                <div className="flex flex-col gap-1.5">
                  <Label>Current password</Label>
                  <Input type="password" value={pwd.current} onChange={(e) => setPwd({ ...pwd, current: e.target.value })} placeholder="••••••••" />
                </div>
                <div className="flex flex-col gap-1.5">
                  <Label>New password</Label>
                  <Input type="password" value={pwd.next} onChange={(e) => setPwd({ ...pwd, next: e.target.value })} placeholder="At least 8 characters" />
                </div>
                <div className="flex flex-col gap-1.5">
                  <Label>Confirm new password</Label>
                  <Input type="password" value={pwd.confirm} onChange={(e) => setPwd({ ...pwd, confirm: e.target.value })} placeholder="Repeat new password" />
                </div>
              </div>
            </CollapsibleCard>
          </div>
        </div>

        {/* Danger zone — full width */}
        <SectionHeader>Danger zone</SectionHeader>
        <Card className="border-red-500/30">
          <CardContent className="pt-5">
            <div className="flex items-center justify-between gap-3 rounded-md border border-border p-3">
              <div className="min-w-0">
                <div className="text-xs font-medium">Clear all logs</div>
                <div className="text-[11px] text-muted-foreground mt-0.5">Permanently delete every request log. Analytics will reset.</div>
              </div>
              <button onClick={() => setConfirmClear(true)}
                className="inline-flex shrink-0 items-center gap-1.5 h-9 px-3.5 rounded-md border border-red-500/30 text-red-600 text-sm font-medium whitespace-nowrap hover:bg-red-500/10 hover:text-red-700 transition-colors">
                <Trash size={13} />Clear logs
              </button>
            </div>
          </CardContent>
        </Card>

      </div>

      <Dialog open={confirmClear} onOpenChange={setConfirmClear} size="sm">
        <div className="p-5">
          <div className="flex items-start gap-3">
            <div className="flex h-9 w-9 items-center justify-center rounded-full bg-red-500/10 shrink-0">
              <AlertTriangle size={16} className="text-red-500" />
            </div>
            <div>
              <h3 className="text-sm font-semibold">Clear all request logs?</h3>
              <p className="text-xs text-muted-foreground mt-1">This permanently deletes all request logs. Analytics history will reset to zero. This action cannot be undone.</p>
            </div>
          </div>
          <div className="mt-5 flex justify-end gap-2">
            <button onClick={() => setConfirmClear(false)} className="h-9 px-3.5 rounded-md border border-border text-sm font-medium hover:bg-muted">Cancel</button>
            <button onClick={clearLogs} className="inline-flex items-center gap-2 h-9 px-3.5 rounded-md bg-red-600 text-white text-sm font-medium hover:bg-red-600/90">
              <Trash size={13} />Yes, clear logs
            </button>
          </div>
        </div>
      </Dialog>
    </>
  );
}
