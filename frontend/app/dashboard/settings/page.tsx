"use client";
import { useState, useEffect } from "react";
import {
  Sun, Moon, Monitor, Check, AlertTriangle, Trash,
  Database, Clock, RefreshCcw, Lock, Palette, Settings2,
  Globe, Eye, EyeOff,
} from "lucide-react";
import { Topbar } from "@/components/shell/Sidebar";
import {
  Card, CardContent, Input, Label, Select, Dialog, Switch, useToast, Skeleton,
  Tabs, TabsList, TabsTrigger, TabsContent,
} from "@/components/ui";
import { api, type AppSettings } from "@/lib/api";

function fmtBytes(b: number): string {
  if (b >= 1_073_741_824) return (b / 1_073_741_824).toFixed(2) + " GB";
  if (b >= 1_048_576) return (b / 1_048_576).toFixed(1) + " MB";
  if (b >= 1_024) return (b / 1_024).toFixed(0) + " KB";
  return b + " B";
}

function SettingRow({
  label, description, children, noBorder = false,
}: {
  label: string;
  description?: string;
  children: React.ReactNode;
  noBorder?: boolean;
}) {
  return (
    <div className={`flex items-start justify-between gap-6 py-4 ${noBorder ? "" : "border-b border-border"}`}>
      <div className="min-w-0 flex-1">
        <div className="text-sm font-medium text-foreground">{label}</div>
        {description && <div className="text-[11.5px] text-muted-foreground mt-0.5 leading-relaxed max-w-sm">{description}</div>}
      </div>
      <div className="shrink-0">{children}</div>
    </div>
  );
}

function SectionBlock({
  icon: Icon, title, children,
}: {
  icon: React.ElementType;
  title: string;
  children: React.ReactNode;
}) {
  return (
    <div>
      <div className="flex items-center gap-2 mb-3">
        <div className="flex h-6 w-6 items-center justify-center rounded-md bg-muted">
          <Icon size={13} className="text-muted-foreground" />
        </div>
        <span className="text-[11px] font-semibold uppercase tracking-widest text-muted-foreground">{title}</span>
      </div>
      <Card>
        <CardContent className="pt-0 px-5 pb-1">{children}</CardContent>
      </Card>
    </div>
  );
}

function SaveButton({ onClick, label = "Save", disabled = false }: { onClick: () => void; label?: string; disabled?: boolean }) {
  return (
    <button
      onClick={onClick}
      disabled={disabled}
      className="h-8 px-4 rounded-md bg-accent text-accent-fg text-xs font-semibold hover:bg-foreground/90 disabled:opacity-50 transition-colors cursor-pointer"
    >
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
  const [httpProxy, setHttpProxy] = useState({ http_proxy_enabled: false, http_proxy_url: "", http_proxy_username: "", http_proxy_password: "" });
  const [showProxyPassword, setShowProxyPassword] = useState(false);
  const [proxyTest, setProxyTest] = useState<{ ok: boolean; message: string; latency_ms?: number } | null>(null);
  const [testingProxy, setTestingProxy] = useState(false);
  const [theme, setTheme] = useState<"light" | "dark" | "system">("system");
  const [confirmClear, setConfirmClear] = useState(false);
  const toast = useToast();

  useEffect(() => {
    api.getSettings().then((s) => {
      setSettings(s);
      setProxy({ proxy_timeout_seconds: s.proxy_timeout_seconds, proxy_max_retries: s.proxy_max_retries, proxy_retry_backoff: s.proxy_retry_backoff });
      setRetention(s.log_retention_days);
      setCurrency({ default_currency: s.default_currency || "USD", usd_to_toman_rate: s.usd_to_toman_rate || 0 });
      setHttpProxy({ http_proxy_enabled: s.http_proxy_enabled ?? false, http_proxy_url: s.http_proxy_url || "", http_proxy_username: s.http_proxy_username || "", http_proxy_password: s.http_proxy_password || "" });
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

  const testHttpProxy = async () => {
    if (!httpProxy.http_proxy_url.trim()) {
      setProxyTest({ ok: false, message: "Proxy URL is empty" });
      return;
    }
    setTestingProxy(true);
    setProxyTest(null);
    try {
      const result = await api.testProxy(httpProxy.http_proxy_url, httpProxy.http_proxy_username, httpProxy.http_proxy_password);
      setProxyTest(result);
    } catch (e: unknown) {
      setProxyTest({ ok: false, message: e instanceof Error ? e.message : "Request failed" });
    } finally {
      setTestingProxy(false);
    }
  };

  const saveHttpProxy = async () => {
    try {
      await api.updateSettings(httpProxy);
      toast({ variant: "success", title: "HTTP proxy settings saved" });
    } catch (e: unknown) {
      toast({ variant: "destructive", title: "Error", description: e instanceof Error ? e.message : "Failed" });
    }
  };

  const saveProxy = async () => {
    try {
      await api.updateSettings(proxy);
      toast({ variant: "success", title: "Proxy settings saved" });
    } catch (e: unknown) {
      toast({ variant: "destructive", title: "Error", description: e instanceof Error ? e.message : "Failed" });
    }
  };

  const saveRetention = async () => {
    try {
      await api.updateSettings({ log_retention_days: retention });
      toast({ variant: "success", title: "Retention policy updated" });
    } catch {
      toast({ variant: "destructive", title: "Error" });
    }
  };

  const saveCurrency = async () => {
    try {
      await api.updateSettings(currency);
      toast({ variant: "success", title: "Currency settings saved" });
    } catch (e: unknown) {
      toast({ variant: "destructive", title: "Error", description: e instanceof Error ? e.message : "Failed" });
    }
  };

  const changePassword = async () => {
    if (pwd.next !== pwd.confirm) { toast({ variant: "destructive", title: "Passwords do not match" }); return; }
    if (pwd.next.length < 8) { toast({ variant: "destructive", title: "Password too short", description: "Minimum 8 characters" }); return; }
    try {
      await api.changePassword(pwd.current, pwd.next);
      toast({ variant: "success", title: "Password updated" });
      setPwd({ current: "", next: "", confirm: "" });
    } catch (e: unknown) {
      toast({ variant: "destructive", title: "Error", description: e instanceof Error ? e.message : "Failed" });
    }
  };

  const clearLogs = async () => {
    try {
      await api.clearLogs();
      toast({ variant: "success", title: "All logs cleared" });
      setConfirmClear(false);
    } catch {
      toast({ variant: "destructive", title: "Error" });
    }
  };

  const retentionPct = Math.round(((retention - 1) / (365 - 1)) * 100);

  return (
    <>
      <Topbar title="Settings" subtitle="Instance configuration" />

      <div className="p-4 md:p-6 max-w-3xl">
        <Tabs defaultValue="appearance">
          <TabsList className="mb-6 h-9">
            <TabsTrigger value="appearance" className="gap-1.5 text-xs">
              <Palette size={12} />Appearance
            </TabsTrigger>
            <TabsTrigger value="data" className="gap-1.5 text-xs">
              <Settings2 size={12} />Data & Proxy
            </TabsTrigger>
            <TabsTrigger value="account" className="gap-1.5 text-xs">
              <Lock size={12} />Account
            </TabsTrigger>
          </TabsList>

          {/* ── Appearance ─────────────────────────────────────── */}
          <TabsContent value="appearance" className="flex flex-col gap-5">

            <SectionBlock icon={Palette} title="Theme">
              <div className="py-4">
                <div className="grid grid-cols-3 gap-3">
                  {([
                    { v: "light" as const, label: "Light", icon: Sun, desc: "Bright interface" },
                    { v: "dark" as const, label: "Dark", icon: Moon, desc: "Easier on the eyes" },
                    { v: "system" as const, label: "System", icon: Monitor, desc: "Follow OS setting" },
                  ] as const).map((opt) => {
                    const Ic = opt.icon;
                    const active = theme === opt.v;
                    return (
                      <button
                        key={opt.v}
                        onClick={() => applyTheme(opt.v)}
                        className={`relative flex flex-col gap-2 rounded-lg border p-4 text-left transition-all cursor-pointer ${
                          active
                            ? "border-foreground bg-muted/60 shadow-sm"
                            : "border-border hover:border-muted-foreground/40 hover:bg-muted/30"
                        }`}
                      >
                        <div className="flex items-center justify-between">
                          <div className={`flex h-8 w-8 items-center justify-center rounded-md ${active ? "bg-foreground text-background" : "bg-muted text-muted-foreground"}`}>
                            <Ic size={15} />
                          </div>
                          {active && (
                            <div className="flex h-5 w-5 items-center justify-center rounded-full bg-foreground">
                              <Check size={11} className="text-background" />
                            </div>
                          )}
                        </div>
                        <div>
                          <div className="text-xs font-semibold">{opt.label}</div>
                          <div className="text-[10.5px] text-muted-foreground mt-0.5">{opt.desc}</div>
                        </div>
                      </button>
                    );
                  })}
                </div>
              </div>
            </SectionBlock>

            <SectionBlock icon={Database} title="Currency">
              {loading ? <Skeleton className="h-[90px] my-4" /> : (
                <>
                  <SettingRow label="Default currency" description="How costs appear across the dashboard and logs.">
                    <Select
                      value={currency.default_currency}
                      onChange={(v) => setCurrency({ ...currency, default_currency: v })}
                      className="w-[200px]"
                      options={[
                        { value: "USD", label: "USD — US Dollar ($)" },
                        { value: "IRT", label: "IRT — Iranian Toman (تومان)" },
                      ]}
                    />
                  </SettingRow>
                  {currency.default_currency === "IRT" && (
                    <SettingRow
                      label="Exchange rate"
                      description="1 USD equals this many Toman. Costs stored in USD are multiplied for display."
                      noBorder
                    >
                      <div className="flex items-center gap-2">
                        <Input
                          type="number"
                          min="0"
                          step="100"
                          value={currency.usd_to_toman_rate || ""}
                          onChange={(e) => setCurrency({ ...currency, usd_to_toman_rate: parseFloat(e.target.value) || 0 })}
                          placeholder="e.g. 65000"
                          className="w-[140px] font-mono text-sm"
                        />
                      </div>
                    </SettingRow>
                  )}
                  <div className="flex justify-end py-3">
                    <SaveButton onClick={saveCurrency} />
                  </div>
                </>
              )}
            </SectionBlock>

          </TabsContent>

          {/* ── Data & Proxy ───────────────────────────────────── */}
          <TabsContent value="data" className="flex flex-col gap-5">

            <SectionBlock icon={Database} title="Log Retention">
              {loading ? <Skeleton className="h-[120px] my-4" /> : (
                <div className="py-4 flex flex-col gap-4">
                  {/* Stats bar */}
                  <div className="grid grid-cols-2 gap-3">
                    <div className="rounded-lg bg-muted/60 border border-border px-4 py-3">
                      <div className="text-[10.5px] text-muted-foreground font-medium uppercase tracking-wide">Retain for</div>
                      <div className="text-xl font-bold font-mono mt-1 tabular-nums">{retention}<span className="text-sm font-normal text-muted-foreground ml-1">days</span></div>
                    </div>
                    <div className="rounded-lg bg-muted/60 border border-border px-4 py-3">
                      <div className="text-[10.5px] text-muted-foreground font-medium uppercase tracking-wide">Database size</div>
                      <div className="text-xl font-bold font-mono mt-1 tabular-nums">
                        {settings ? fmtBytes(settings.db_size_bytes) : "—"}
                      </div>
                    </div>
                  </div>

                  {/* Slider */}
                  <div className="flex flex-col gap-2">
                    <div className="relative pt-1">
                      <input
                        type="range"
                        min="1"
                        max="365"
                        value={retention}
                        onChange={(e) => setRetention(parseInt(e.target.value))}
                        className="w-full accent-foreground"
                      />
                      <div className="mt-1.5 flex justify-between text-[10px] font-mono text-muted-foreground">
                        <span>1d</span><span>30d</span><span>90d</span><span>180d</span><span>365d</span>
                      </div>
                    </div>

                    {/* Visual progress */}
                    <div className="h-1.5 w-full rounded-full bg-muted overflow-hidden">
                      <div
                        className="h-full rounded-full bg-foreground/70 transition-all duration-150"
                        style={{ width: `${retentionPct}%` }}
                      />
                    </div>
                    <p className="text-[10.5px] text-muted-foreground">Logs older than {retention} day{retention !== 1 ? "s" : ""} are automatically deleted.</p>
                  </div>

                  <div className="flex justify-end">
                    <SaveButton onClick={saveRetention} />
                  </div>
                </div>
              )}
            </SectionBlock>

            <SectionBlock icon={Globe} title="Outbound HTTP Proxy">
              {loading ? <Skeleton className="h-[100px] my-4" /> : (
                <div className="py-4 flex flex-col gap-4">
                  <SettingRow
                    label="Enable HTTP proxy"
                    description="Route all outbound connections to AI providers through an HTTP proxy."
                    noBorder={!httpProxy.http_proxy_enabled}
                  >
                    <Switch
                      checked={httpProxy.http_proxy_enabled}
                      onCheckedChange={(v) => setHttpProxy({ ...httpProxy, http_proxy_enabled: v })}
                    />
                  </SettingRow>

                  {httpProxy.http_proxy_enabled && (
                    <div className="flex flex-col gap-4 pt-1">
                      <div className="flex flex-col gap-1.5">
                        <Label>Proxy URL</Label>
                        <Input
                          type="text"
                          value={httpProxy.http_proxy_url}
                          onChange={(e) => setHttpProxy({ ...httpProxy, http_proxy_url: e.target.value })}
                          placeholder="http://host:port"
                          className="font-mono text-sm"
                        />
                        <p className="text-[10.5px] text-muted-foreground">e.g. <span className="font-mono">http://127.0.0.1:7890</span> or <span className="font-mono">socks5://host:port</span></p>
                      </div>

                      <div className="grid grid-cols-2 gap-4">
                        <div className="flex flex-col gap-1.5">
                          <Label>Username <span className="text-muted-foreground font-normal">(optional)</span></Label>
                          <Input
                            type="text"
                            value={httpProxy.http_proxy_username}
                            onChange={(e) => setHttpProxy({ ...httpProxy, http_proxy_username: e.target.value })}
                            placeholder="username"
                            autoComplete="off"
                          />
                        </div>
                        <div className="flex flex-col gap-1.5">
                          <Label>Password <span className="text-muted-foreground font-normal">(optional)</span></Label>
                          <div className="relative">
                            <Input
                              type={showProxyPassword ? "text" : "password"}
                              value={httpProxy.http_proxy_password}
                              onChange={(e) => setHttpProxy({ ...httpProxy, http_proxy_password: e.target.value })}
                              placeholder="••••••••"
                              className="pr-9"
                              autoComplete="new-password"
                            />
                            <button
                              type="button"
                              onClick={() => setShowProxyPassword((v) => !v)}
                              className="absolute right-2.5 top-1/2 -translate-y-1/2 text-muted-foreground hover:text-foreground transition-colors cursor-pointer"
                              tabIndex={-1}
                            >
                              {showProxyPassword ? <EyeOff size={13} /> : <Eye size={13} />}
                            </button>
                          </div>
                        </div>
                      </div>
                    </div>
                  )}

                  {proxyTest && (
                    <div className={`flex items-start gap-2.5 rounded-md border px-3.5 py-2.5 text-xs ${
                      proxyTest.ok
                        ? "border-green-500/25 bg-green-500/5 text-green-600 dark:text-green-400"
                        : "border-red-500/25 bg-red-500/5 text-red-600 dark:text-red-400"
                    }`}>
                      <div className={`mt-0.5 shrink-0 h-3.5 w-3.5 rounded-full flex items-center justify-center ${proxyTest.ok ? "bg-green-500/20" : "bg-red-500/20"}`}>
                        {proxyTest.ok
                          ? <Check size={8} className="text-green-600 dark:text-green-400" />
                          : <span className="text-[9px] font-bold leading-none">✕</span>}
                      </div>
                      <div className="min-w-0 flex-1">
                        <span className="font-medium">{proxyTest.ok ? "Proxy reachable" : "Connection failed"}</span>
                        {" — "}
                        <span className="text-muted-foreground">{proxyTest.message}</span>
                        {proxyTest.latency_ms != null && (
                          <span className="ml-2 font-mono text-[10.5px] text-muted-foreground">{proxyTest.latency_ms}ms</span>
                        )}
                      </div>
                    </div>
                  )}

                  <div className="flex items-center justify-end gap-2">
                    {httpProxy.http_proxy_enabled && (
                      <button
                        onClick={testHttpProxy}
                        disabled={testingProxy || !httpProxy.http_proxy_url.trim()}
                        className="h-8 px-4 rounded-md border border-border text-xs font-medium hover:bg-muted disabled:opacity-50 transition-colors cursor-pointer"
                      >
                        {testingProxy ? "Testing…" : "Test connection"}
                      </button>
                    )}
                    <SaveButton onClick={saveHttpProxy} label="Save proxy" />
                  </div>
                </div>
              )}
            </SectionBlock>

            <SectionBlock icon={RefreshCcw} title="Proxy Behaviour">
              {loading ? <Skeleton className="h-[140px] my-4" /> : (
                <div className="py-4 flex flex-col gap-4">
                  <div className="grid grid-cols-2 gap-4">
                    <div className="flex flex-col gap-1.5">
                      <Label className="flex items-center gap-1.5">
                        <Clock size={11} className="text-muted-foreground" />
                        Request timeout
                      </Label>
                      <div className="relative">
                        <Input
                          type="number"
                          value={proxy.proxy_timeout_seconds}
                          onChange={(e) => setProxy({ ...proxy, proxy_timeout_seconds: parseInt(e.target.value) || 0 })}
                          className="pr-10"
                        />
                        <span className="pointer-events-none absolute right-3 top-1/2 -translate-y-1/2 text-[11px] text-muted-foreground font-mono">s</span>
                      </div>
                    </div>
                    <div className="flex flex-col gap-1.5">
                      <Label>Max retries</Label>
                      <Input
                        type="number"
                        value={proxy.proxy_max_retries}
                        onChange={(e) => setProxy({ ...proxy, proxy_max_retries: parseInt(e.target.value) || 0 })}
                      />
                    </div>
                  </div>

                  <div className="flex flex-col gap-1.5">
                    <Label>Retry backoff strategy</Label>
                    <Select
                      value={proxy.proxy_retry_backoff}
                      onChange={(v) => setProxy({ ...proxy, proxy_retry_backoff: v })}
                      options={[
                        { value: "exponential", label: "Exponential (recommended)" },
                        { value: "linear", label: "Linear" },
                        { value: "constant", label: "Constant 500ms" },
                      ]}
                    />
                    <p className="text-[10.5px] text-muted-foreground">On 429 / 5xx errors, retry with the next provider by weight.</p>
                  </div>

                  <div className="flex justify-end">
                    <SaveButton onClick={saveProxy} label="Save changes" />
                  </div>
                </div>
              )}
            </SectionBlock>

          </TabsContent>

          {/* ── Account ────────────────────────────────────────── */}
          <TabsContent value="account" className="flex flex-col gap-5">

            <SectionBlock icon={Lock} title="Password">
              <div className="py-4 flex flex-col gap-4 max-w-sm">
                <div className="flex flex-col gap-1.5">
                  <Label>Current password</Label>
                  <Input
                    type="password"
                    value={pwd.current}
                    onChange={(e) => setPwd({ ...pwd, current: e.target.value })}
                    placeholder="••••••••"
                  />
                </div>
                <div className="flex flex-col gap-1.5">
                  <Label>New password</Label>
                  <Input
                    type="password"
                    value={pwd.next}
                    onChange={(e) => setPwd({ ...pwd, next: e.target.value })}
                    placeholder="At least 8 characters"
                  />
                </div>
                <div className="flex flex-col gap-1.5">
                  <Label>Confirm new password</Label>
                  <Input
                    type="password"
                    value={pwd.confirm}
                    onChange={(e) => setPwd({ ...pwd, confirm: e.target.value })}
                    placeholder="Repeat new password"
                  />
                </div>
                <div className="flex justify-end">
                  <SaveButton onClick={changePassword} label="Update password" />
                </div>
              </div>
            </SectionBlock>

            <SectionBlock icon={Trash} title="Danger Zone">
              <div className="py-4">
                <div className="flex items-center justify-between gap-4 rounded-lg border border-red-500/25 bg-red-500/5 px-4 py-3.5">
                  <div>
                    <div className="text-sm font-medium text-foreground">Clear all logs</div>
                    <div className="text-[11.5px] text-muted-foreground mt-0.5">
                      Permanently deletes every request log. Analytics will reset to zero.
                    </div>
                  </div>
                  <button
                    onClick={() => setConfirmClear(true)}
                    className="inline-flex shrink-0 items-center gap-1.5 h-8 px-3.5 rounded-md border border-red-500/30 text-red-600 text-xs font-semibold whitespace-nowrap hover:bg-red-500/10 hover:text-red-700 transition-colors cursor-pointer"
                  >
                    <Trash size={12} />Clear logs
                  </button>
                </div>
              </div>
            </SectionBlock>

          </TabsContent>
        </Tabs>
      </div>

      <Dialog open={confirmClear} onOpenChange={setConfirmClear} size="sm">
        <div className="p-5">
          <div className="flex items-start gap-3">
            <div className="flex h-9 w-9 items-center justify-center rounded-full bg-red-500/10 shrink-0">
              <AlertTriangle size={16} className="text-red-500" />
            </div>
            <div>
              <h3 className="text-sm font-semibold">Clear all request logs?</h3>
              <p className="text-xs text-muted-foreground mt-1">
                This permanently deletes all request logs. Analytics history will reset to zero. This action cannot be undone.
              </p>
            </div>
          </div>
          <div className="mt-5 flex justify-end gap-2">
            <button
              onClick={() => setConfirmClear(false)}
              className="h-9 px-3.5 rounded-md border border-border text-sm font-medium hover:bg-muted cursor-pointer"
            >
              Cancel
            </button>
            <button
              onClick={clearLogs}
              className="inline-flex items-center gap-2 h-9 px-3.5 rounded-md bg-red-600 text-white text-sm font-medium hover:bg-red-600/90 cursor-pointer"
            >
              <Trash size={13} />Yes, clear logs
            </button>
          </div>
        </div>
      </Dialog>
    </>
  );
}
