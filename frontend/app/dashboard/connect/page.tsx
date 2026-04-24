"use client";
import { useState, useEffect, useCallback, useMemo } from "react";
import { Plus, Trash, Copy, Check, AlertTriangle, Clock, Eye, EyeOff, Cable, RefreshCw } from "lucide-react";
import { Topbar } from "@/components/shell/Sidebar";
import { Card, CardHeader, CardTitle, CardDescription, CardContent, Badge, Dialog, Input, Label, Skeleton, useToast } from "@/components/ui";
import { api, type AppSettings, type ApiToken } from "@/lib/api";
import { fmtTime, fmtDateTime } from "@/lib/utils";

function timeAgo(iso: string): string {
  const diff = Date.now() - new Date(iso).getTime();
  const m = Math.floor(diff / 60000);
  if (m < 1) return "just now";
  if (m < 60) return `${m}m ago`;
  const h = Math.floor(m / 60);
  if (h < 24) return `${h}h ago`;
  return `${Math.floor(h / 24)}d ago`;
}

function isExpired(iso: string | null): boolean {
  if (!iso) return false;
  return new Date(iso) < new Date();
}

// — Syntax highlighter ——————————————————————————————
type TRule = [RegExp, string]; // [pattern, hex color]
const H = {
  comment: "#6b7280", string: "#4ade80", keyword: "#c084fc",
  number: "#fb923c",  url: "#38bdf8",   func: "#fbbf24",
  type_: "#67e8f9",   flag: "#22d3ee",  cmd: "#60a5fa",
  literal: "#f97316", plain: "",
};
const RULES: Record<string, TRule[]> = {
  bash: [
    [/^(#[^\n]*)/, H.comment],
    [/^(https?:\/\/[^\s\\']+)/, H.url],
    [/^("(?:[^"\\]|\\.)*")/, H.string],
    [/^('(?:[^'\\]|\\.)*')/, H.string],
    [/^(-{1,2}[a-zA-Z][a-zA-Z0-9_-]*)/, H.flag],
    [/^(curl|echo|cat|grep|sed|awk|sh|bash)(?=[\s\\$])/, H.cmd],
    [/^(\d+\.?\d*)/, H.number],
    [/^([a-zA-Z_][a-zA-Z0-9_]*)/, H.plain],
  ],
  python: [
    [/^(#[^\n]*)/, H.comment],
    [/^("""[\s\S]*?"""|'''[\s\S]*?''')/, H.string],
    [/^(f?"(?:[^"\\]|\\.)*")/, H.string],
    [/^(f?'(?:[^'\\]|\\.)*')/, H.string],
    [/^(from|import|def|class|return|async|await|if|elif|else|for|while|try|except|finally|with|as|pass|break|continue|raise|yield|lambda|not|and|or|in|is)(?=\b)/, H.keyword],
    [/^(True|False|None)(?=\b)/, H.literal],
    [/^(print|len|range|list|dict|str|int|float|bool|type|super)(?=\()/, H.cmd],
    [/^([a-zA-Z_][a-zA-Z0-9_]*)(?=\()/, H.func],
    [/^(\d+\.?\d*)/, H.number],
    [/^([a-zA-Z_][a-zA-Z0-9_]*)/, H.plain],
  ],
  typescript: [
    [/^(\/\/[^\n]*)/, H.comment],
    [/^(`(?:[^`\\]|\\.)*`)/, H.string],
    [/^("(?:[^"\\]|\\.)*")/, H.string],
    [/^('(?:[^'\\]|\\.)*')/, H.string],
    [/^(import|from|export|default|const|let|var|type|interface|class|extends|async|await|return|new|if|else|for|while|try|catch|of|in|as|typeof)(?=\b)/, H.keyword],
    [/^(string|number|boolean|void|null|undefined|any|never|unknown|Promise|Array)(?=\b)/, H.type_],
    [/^(true|false|null|undefined)(?=\b)/, H.literal],
    [/^([A-Z][a-zA-Z0-9_]*)/, H.type_],
    [/^([a-zA-Z_][a-zA-Z0-9_]*)(?=\()/, H.func],
    [/^(\d+\.?\d*)/, H.number],
    [/^([a-zA-Z_][a-zA-Z0-9_]*)/, H.plain],
  ],
};

function tokenize(code: string, lang: string): Array<{ text: string; color: string }> {
  const rules = RULES[lang] ?? [];
  const out: Array<{ text: string; color: string }> = [];
  let pos = 0;
  while (pos < code.length) {
    const slice = code.slice(pos);
    const ws = slice.match(/^(\s+)/);
    if (ws) { out.push({ text: ws[1], color: "" }); pos += ws[1].length; continue; }
    let hit = false;
    for (const [re, color] of rules) {
      const m = slice.match(re);
      if (m) { out.push({ text: m[1] ?? m[0], color }); pos += m[0].length; hit = true; break; }
    }
    if (!hit) { out.push({ text: slice[0], color: "" }); pos++; }
  }
  return out;
}

function CodeBlock({ code, language = "bash" }: { code: string; language?: string }) {
  const [copied, setCopied] = useState(false);
  const copy = () => { navigator.clipboard.writeText(code); setCopied(true); setTimeout(() => setCopied(false), 1500); };
  const tokens = useMemo(() => tokenize(code, language), [code, language]);
  const langLabel = language === "typescript" ? "TypeScript" : language.charAt(0).toUpperCase() + language.slice(1);
  return (
    <div className="rounded-lg border border-zinc-800 bg-zinc-950 overflow-hidden">
      <div className="flex items-center justify-between border-b border-zinc-800 px-4 py-2">
        <div className="flex items-center gap-1.5">
          <span className="h-2 w-2 rounded-full bg-red-500/60" />
          <span className="h-2 w-2 rounded-full bg-yellow-500/60" />
          <span className="h-2 w-2 rounded-full bg-green-500/60" />
        </div>
        <span className="text-[10px] text-zinc-500 font-mono">{langLabel}</span>
        <button onClick={copy} className="inline-flex items-center gap-1 text-[11px] text-zinc-500 hover:text-zinc-300 transition-colors">
          {copied ? <><Check size={11} />Copied</> : <><Copy size={11} />Copy</>}
        </button>
      </div>
      <pre className="p-5 text-[12px] font-mono leading-[1.7] overflow-x-auto whitespace-pre text-zinc-300">
        <code>
          {tokens.map((t, i) =>
            t.color
              ? <span key={i} style={{ color: t.color }}>{t.text}</span>
              : t.text
          )}
        </code>
      </pre>
    </div>
  );
}

export default function ConnectPage() {
  const [settings, setSettings] = useState<AppSettings | null>(null);
  const [tokens, setTokens] = useState<ApiToken[]>([]);
  const [loading, setLoading] = useState(true);
  const [createOpen, setCreateOpen] = useState(false);
  const [newName, setNewName] = useState("");
  const [newExpiry, setNewExpiry] = useState("");
  const [creating, setCreating] = useState(false);
  const [createdToken, setCreatedToken] = useState<string | null>(null);
  const [showToken, setShowToken] = useState(false);
  const [revokeId, setRevokeId] = useState<number | null>(null);
  const [regenerateId, setRegenerateId] = useState<number | null>(null);
  const [regenerating, setRegenerating] = useState(false);
  const [codeTab, setCodeTab] = useState<"curl" | "python" | "typescript">("curl");
  const toast = useToast();

  const load = useCallback(async () => {
    try {
      const [s, t] = await Promise.all([api.getSettings(), api.getTokens()]);
      setSettings(s);
      setTokens(t);
    } catch { /* ignore */ }
    finally { setLoading(false); }
  }, []);

  useEffect(() => { load(); }, [load]);

  const baseUrl = (settings?.proxy_base_url || "http://localhost:8000").replace(/\/$/, "");
  const requireAuth = settings?.require_proxy_auth ?? false;
  const tokenPlaceholder = tokens.length > 0 ? `${tokens[0].token_prefix}****` : "sk-lm-YOUR_TOKEN";

  const createToken = async () => {
    if (!newName.trim()) { toast({ variant: "destructive", title: "Name is required" }); return; }
    setCreating(true);
    try {
      const result = await api.createToken({
        name: newName.trim(),
        expires_at: newExpiry ? new Date(newExpiry).toISOString() : undefined,
      });
      setCreatedToken(result.token);
      setShowToken(false);
      setTokens((prev) => [result, ...prev]);
      setNewName("");
      setNewExpiry("");
    } catch (e: unknown) {
      toast({ variant: "destructive", title: "Error", description: e instanceof Error ? e.message : "Failed" });
      setCreateOpen(false);
    } finally { setCreating(false); }
  };

  const revokeToken = async (id: number) => {
    try {
      await api.revokeToken(id);
      setTokens((prev) => prev.filter((t) => t.id !== id));
      setRevokeId(null);
      toast({ variant: "success", title: "Token revoked" });
    } catch {
      toast({ variant: "destructive", title: "Failed to revoke token" });
    }
  };

  const regenerateToken = async (id: number) => {
    setRegenerating(true);
    try {
      const oldToken = tokens.find((t) => t.id === id);
      if (!oldToken) throw new Error("Token not found");

      // Create new token with same name and expiry
      const result = await api.createToken({
        name: oldToken.name,
        expires_at: oldToken.expires_at || undefined,
      });

      // Delete old token
      await api.revokeToken(id);

      // Update tokens list
      setTokens((prev) => [result, ...prev.filter((t) => t.id !== id)]);
      setCreatedToken(result.token);
      setShowToken(false);
      setCreateOpen(true);
      setRegenerateId(null);
      toast({ variant: "success", title: "Token regenerated" });
    } catch (e: unknown) {
      toast({ variant: "destructive", title: "Error", description: e instanceof Error ? e.message : "Failed" });
    } finally {
      setRegenerating(false);
    }
  };

  const curlExample = `curl ${baseUrl}/v1/chat/completions \\
  -H "Content-Type: application/json" \\${requireAuth ? `\n  -H "Authorization: Bearer ${tokenPlaceholder}" \\` : ""}
  -d '{
    "model": "gpt-4o",
    "messages": [
      {"role": "user", "content": "Hello!"}
    ]
  }'`;

  const pythonExample = `from openai import OpenAI

client = OpenAI(
    api_key="${requireAuth ? tokenPlaceholder : "any-string"}",
    base_url="${baseUrl}/v1",
)

response = client.chat.completions.create(
    model="gpt-4o",
    messages=[{"role": "user", "content": "Hello!"}],
)
print(response.choices[0].message.content)`;

  const tsExample = `import OpenAI from "openai";

const client = new OpenAI({
  apiKey: "${requireAuth ? tokenPlaceholder : "any-string"}",
  baseURL: "${baseUrl}/v1",
});

const response = await client.chat.completions.create({
  model: "gpt-4o",
  messages: [{ role: "user", content: "Hello!" }],
});
console.log(response.choices[0].message.content);`;

  return (
    <>
      <Topbar title="Connect" subtitle="API tokens and integration guide" />

      <div className="p-4 md:p-6 flex flex-col gap-5 max-w-[820px]">

        {/* API Tokens */}
        <Card>
          <CardHeader>
            <div className="flex items-start justify-between">
              <div>
                <CardTitle>API tokens</CardTitle>
                <CardDescription>Create tokens for client applications to authenticate with LLMeter</CardDescription>
              </div>
              <button onClick={() => { setCreateOpen(true); setCreatedToken(null); }}
                className="inline-flex items-center gap-1.5 h-8 px-3 rounded-md bg-accent text-accent-fg text-xs font-medium hover:bg-foreground/90 shrink-0">
                <Plus size={12} />New token
              </button>
            </div>
          </CardHeader>
          <CardContent>
            {loading ? (
              <div className="flex flex-col gap-2">{Array.from({ length: 2 }).map((_, i) => <Skeleton key={i} className="h-12" />)}</div>
            ) : tokens.length === 0 ? (
              <div className="flex flex-col items-center justify-center py-10 text-center">
                <Cable size={22} className="text-muted-foreground opacity-40 mb-2" />
                <div className="text-sm font-medium text-foreground">No tokens yet</div>
                <div className="text-[11px] text-muted-foreground mt-0.5">Create a token to authenticate proxy requests.</div>
              </div>
            ) : (
              <div className="flex flex-col divide-y divide-border">
                {tokens.map((token) => {
                  const expired = isExpired(token.expires_at);
                  return (
                    <div key={token.id} className="flex items-center justify-between gap-3 py-3 first:pt-0 last:pb-0">
                      <div className="min-w-0">
                        <div className="flex items-center gap-2">
                          <span className="text-sm font-medium truncate">{token.name}</span>
                          {expired
                            ? <Badge variant="destructive">Expired {fmtDateTime(token.expires_at!)}</Badge>
                            : token.expires_at
                              ? <Badge variant="warning"><Clock size={10} className="mr-1" />{fmtDateTime(token.expires_at)}</Badge>
                              : <Badge variant="success">No expiry</Badge>
                          }
                        </div>
                        <div className="flex items-center gap-2 mt-0.5">
                          <code className="text-[11px] font-mono text-muted-foreground">{token.token_prefix}••••••••••••</code>
                          <span className="text-[10px] text-muted-foreground">
                            Created {timeAgo(token.created_at)}
                            {token.last_used_at && ` · Used ${timeAgo(token.last_used_at)}`}
                          </span>
                        </div>
                      </div>
                      <div className="flex items-center gap-1">
                        <button onClick={() => setRegenerateId(token.id)}
                          className="shrink-0 h-7 w-7 inline-flex items-center justify-center rounded-md text-muted-foreground hover:text-accent hover:bg-accent/10 transition-colors">
                          <RefreshCw size={13} />
                        </button>
                        <button onClick={() => setRevokeId(token.id)}
                          className="shrink-0 h-7 w-7 inline-flex items-center justify-center rounded-md text-muted-foreground hover:text-red-600 hover:bg-red-500/10 transition-colors">
                          <Trash size={13} />
                        </button>
                      </div>
                    </div>
                  );
                })}
              </div>
            )}
          </CardContent>
        </Card>

        {/* Code examples */}
        <Card>
          <CardHeader>
            <CardTitle>Code examples</CardTitle>
            <CardDescription>Drop-in replacements for the OpenAI SDK — point to LLMeter instead</CardDescription>
          </CardHeader>
          <CardContent className="flex flex-col gap-3">
            <div className="flex gap-1.5">
              {(["curl", "python", "typescript"] as const).map((t) => (
                <button key={t} onClick={() => setCodeTab(t)}
                  className={`h-7 px-3 rounded-md text-[11px] font-medium transition-colors ${codeTab === t ? "bg-accent text-accent-fg" : "text-muted-foreground hover:text-foreground hover:bg-muted"}`}>
                  {t === "typescript" ? "TypeScript" : t.charAt(0).toUpperCase() + t.slice(1)}
                </button>
              ))}
            </div>
            {codeTab === "curl" && <CodeBlock code={curlExample} language="bash" />}
            {codeTab === "python" && <CodeBlock code={pythonExample} language="python" />}
            {codeTab === "typescript" && <CodeBlock code={tsExample} language="typescript" />}
            <p className="text-[10.5px] text-muted-foreground">
              LLMeter is fully OpenAI-compatible. Any model name you request is forwarded to your configured providers and resolved via model aliases.
            </p>
          </CardContent>
        </Card>

      </div>

      {/* Create token dialog */}
      <Dialog open={createOpen} onOpenChange={(v) => { setCreateOpen(v); if (!v) setCreatedToken(null); }} size="sm">
        <div className="p-5 flex flex-col gap-4">
          {createdToken ? (
            <>
              <div>
                <h3 className="text-sm font-semibold">Token created</h3>
                <p className="text-xs text-muted-foreground mt-1">Copy this token now — it will not be shown again.</p>
              </div>
              <div className="rounded-md border border-border bg-muted/30 p-3 flex items-center gap-2">
                <code className="flex-1 text-xs font-mono break-all select-all">
                  {showToken ? createdToken : createdToken.slice(0, 14) + "•".repeat(createdToken.length - 14)}
                </code>
                <button onClick={() => setShowToken(!showToken)}
                  className="shrink-0 h-7 w-7 inline-flex items-center justify-center rounded text-muted-foreground hover:text-foreground">
                  {showToken ? <EyeOff size={13} /> : <Eye size={13} />}
                </button>
                <button onClick={() => { navigator.clipboard.writeText(createdToken); toast({ variant: "success", title: "Token copied" }); }}
                  className="shrink-0 h-7 px-2 inline-flex items-center gap-1 rounded text-xs text-muted-foreground hover:text-foreground hover:bg-muted">
                  <Copy size={11} />Copy
                </button>
              </div>
              <div className="flex items-start gap-2 text-[11px] text-amber-700 dark:text-amber-400">
                <AlertTriangle size={13} className="shrink-0 mt-0.5" />
                Store this token securely. It cannot be recovered after closing this dialog.
              </div>
              <div className="flex justify-end">
                <button onClick={() => setCreateOpen(false)}
                  className="h-9 px-3.5 rounded-md bg-accent text-accent-fg text-sm font-medium hover:bg-foreground/90">
                  Done
                </button>
              </div>
            </>
          ) : (
            <>
              <div>
                <h3 className="text-sm font-semibold">Create API token</h3>
                <p className="text-xs text-muted-foreground mt-1">Tokens are shown only once after creation.</p>
              </div>
              <div className="flex flex-col gap-3">
                <div className="flex flex-col gap-1.5">
                  <Label>Token name</Label>
                  <Input value={newName} onChange={(e) => setNewName(e.target.value)}
                    placeholder="e.g. Production app, Dev machine" autoFocus />
                </div>
                <div className="flex flex-col gap-1.5">
                  <Label>Expiration <span className="text-muted-foreground font-normal">(leave empty for no expiry)</span></Label>
                  <Input type="datetime-local" value={newExpiry} onChange={(e) => setNewExpiry(e.target.value)} />
                  {!newExpiry && (
                    <p className="text-[10.5px] text-amber-700 dark:text-amber-400 flex items-center gap-1">
                      <AlertTriangle size={11} />No expiration — the token will be valid indefinitely.
                    </p>
                  )}
                </div>
              </div>
              <div className="flex justify-end gap-2">
                <button onClick={() => setCreateOpen(false)}
                  className="h-9 px-3.5 rounded-md border border-border text-sm font-medium hover:bg-muted">
                  Cancel
                </button>
                <button onClick={createToken} disabled={creating || !newName.trim()}
                  className="h-9 px-3.5 rounded-md bg-accent text-accent-fg text-sm font-medium hover:bg-foreground/90 disabled:opacity-50">
                  {creating ? "Creating…" : "Create token"}
                </button>
              </div>
            </>
          )}
        </div>
      </Dialog>

      {/* Revoke confirmation dialog */}
      <Dialog open={revokeId !== null} onOpenChange={(v) => { if (!v) setRevokeId(null); }} size="sm">
        <div className="p-5">
          <div className="flex items-start gap-3 mb-5">
            <div className="flex h-9 w-9 items-center justify-center rounded-full bg-red-500/10 shrink-0">
              <AlertTriangle size={16} className="text-red-500" />
            </div>
            <div>
              <h3 className="text-sm font-semibold">Revoke this token?</h3>
              <p className="text-xs text-muted-foreground mt-1">
                Any applications using this token will immediately lose access. This action cannot be undone.
              </p>
            </div>
          </div>
          <div className="flex justify-end gap-2">
            <button onClick={() => setRevokeId(null)}
              className="h-9 px-3.5 rounded-md border border-border text-sm font-medium hover:bg-muted">
              Cancel
            </button>
            <button onClick={() => revokeId !== null && revokeToken(revokeId)}
              className="inline-flex items-center gap-2 h-9 px-3.5 rounded-md bg-red-600 text-white text-sm font-medium hover:bg-red-600/90">
              <Trash size={13} />Revoke token
            </button>
          </div>
        </div>
      </Dialog>

      {/* Regenerate confirmation dialog */}
      <Dialog open={regenerateId !== null} onOpenChange={(v) => { if (!v) setRegenerateId(null); }} size="sm">
        <div className="p-5">
          <div className="flex items-start gap-3 mb-5">
            <div className="flex h-9 w-9 items-center justify-center rounded-full bg-accent/10 shrink-0">
              <RefreshCw size={16} className="text-accent" />
            </div>
            <div>
              <h3 className="text-sm font-semibold">Regenerate this token?</h3>
              <p className="text-xs text-muted-foreground mt-1">
                A new token will be created and the old one will be revoked. Any applications using the old token will need to be updated.
              </p>
            </div>
          </div>
          <div className="flex justify-end gap-2">
            <button onClick={() => setRegenerateId(null)}
              className="h-9 px-3.5 rounded-md border border-border text-sm font-medium hover:bg-muted">
              Cancel
            </button>
            <button onClick={() => regenerateId !== null && regenerateToken(regenerateId)} disabled={regenerating}
              className="inline-flex items-center gap-2 h-9 px-3.5 rounded-md bg-accent text-accent-fg text-sm font-medium hover:bg-foreground/90 disabled:opacity-50">
              {regenerating ? "Regenerating..." : <><RefreshCw size={13} />Regenerate</>}
            </button>
          </div>
        </div>
      </Dialog>
    </>
  );
}
