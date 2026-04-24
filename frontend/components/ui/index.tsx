"use client";
import * as React from "react";
import * as SwitchPrimitive from "@radix-ui/react-switch";
import * as TabsPrimitive from "@radix-ui/react-tabs";
import * as TooltipPrimitive from "@radix-ui/react-tooltip";
import * as SeparatorPrimitive from "@radix-ui/react-separator";
import * as LabelPrimitive from "@radix-ui/react-label";
import { cn } from "@/lib/utils";
import { Info } from "lucide-react";

// Input
export const Input = React.forwardRef<HTMLInputElement, React.InputHTMLAttributes<HTMLInputElement>>(
  ({ className, ...props }, ref) => (
    <input
      ref={ref}
      className={cn(
        "flex h-9 w-full rounded-md border border-border bg-background px-3 py-1 text-sm shadow-sm transition-colors placeholder:text-muted-foreground focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring disabled:cursor-not-allowed disabled:opacity-50",
        className
      )}
      {...props}
    />
  )
);
Input.displayName = "Input";

// Textarea
export const Textarea = React.forwardRef<HTMLTextAreaElement, React.TextareaHTMLAttributes<HTMLTextAreaElement>>(
  ({ className, ...props }, ref) => (
    <textarea
      ref={ref}
      className={cn(
        "flex min-h-[80px] w-full rounded-md border border-border bg-background px-3 py-2 text-sm shadow-sm placeholder:text-muted-foreground focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring",
        className
      )}
      {...props}
    />
  )
);
Textarea.displayName = "Textarea";

// Label
export const Label = React.forwardRef<HTMLLabelElement, React.LabelHTMLAttributes<HTMLLabelElement>>(
  ({ className, ...props }, ref) => (
    <LabelPrimitive.Root
      ref={ref}
      className={cn("text-xs font-medium text-foreground", className)}
      {...props}
    />
  )
);
Label.displayName = "Label";

// Card
export function Card({ className, children }: { className?: string; children: React.ReactNode }) {
  return <div className={cn("rounded-lg border border-border bg-background shadow-sm", className)}>{children}</div>;
}
export function CardHeader({ className, children }: { className?: string; children: React.ReactNode }) {
  return <div className={cn("flex flex-col space-y-1 p-5", className)}>{children}</div>;
}
export function CardTitle({ className, children }: { className?: string; children: React.ReactNode }) {
  return <h3 className={cn("text-sm font-semibold text-foreground tracking-tight", className)}>{children}</h3>;
}
export function CardDescription({ className, children }: { className?: string; children: React.ReactNode }) {
  return <p className={cn("text-xs text-muted-foreground", className)}>{children}</p>;
}
export function CardContent({ className, children }: { className?: string; children: React.ReactNode }) {
  return <div className={cn("p-5 pt-0", className)}>{children}</div>;
}
export function CardFooter({ className, children }: { className?: string; children: React.ReactNode }) {
  return <div className={cn("flex items-center p-5 pt-0", className)}>{children}</div>;
}

// Badge
export function Badge({
  variant = "default",
  className,
  children,
}: {
  variant?: "default" | "outline" | "success" | "warning" | "destructive" | "info";
  className?: string;
  children: React.ReactNode;
}) {
  const variants = {
    default: "bg-muted text-muted-foreground border-transparent",
    outline: "border border-border text-foreground",
    success: "bg-emerald-500/12 text-emerald-600 border-emerald-500/20 dark:text-emerald-400",
    warning: "bg-amber-500/14 text-amber-700 border-amber-500/20 dark:text-amber-400",
    destructive: "bg-red-500/12 text-red-600 border-red-500/20 dark:text-red-400",
    info: "bg-sky-500/12 text-sky-600 border-sky-500/20 dark:text-sky-400",
  };
  return (
    <span className={cn("inline-flex items-center gap-1 rounded-md border px-1.5 py-0.5 text-[10.5px] font-medium tabular-nums", variants[variant], className)}>
      {children}
    </span>
  );
}

// Separator
export const Separator = React.forwardRef<
  React.ElementRef<typeof SeparatorPrimitive.Root>,
  React.ComponentPropsWithoutRef<typeof SeparatorPrimitive.Root>
>(({ className, orientation = "horizontal", decorative = true, ...props }, ref) => (
  <SeparatorPrimitive.Root
    ref={ref}
    decorative={decorative}
    orientation={orientation}
    className={cn("bg-border", orientation === "horizontal" ? "h-px w-full" : "h-full w-px", className)}
    {...props}
  />
));
Separator.displayName = SeparatorPrimitive.Root.displayName;

// Switch
export const Switch = React.forwardRef<
  React.ElementRef<typeof SwitchPrimitive.Root>,
  React.ComponentPropsWithoutRef<typeof SwitchPrimitive.Root>
>(({ className, ...props }, ref) => (
  <SwitchPrimitive.Root
    ref={ref}
    className={cn(
      "peer inline-flex h-5 w-9 shrink-0 cursor-pointer items-center rounded-full border transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring disabled:cursor-not-allowed disabled:opacity-50 data-[state=checked]:bg-accent data-[state=checked]:border-accent data-[state=unchecked]:bg-muted data-[state=unchecked]:border-border",
      className
    )}
    {...props}
  >
    <SwitchPrimitive.Thumb
      className={cn(
        "pointer-events-none block h-3.5 w-3.5 rounded-full bg-background shadow-lg ring-0 transition-transform data-[state=checked]:translate-x-[18px] data-[state=unchecked]:translate-x-0.5"
      )}
    />
  </SwitchPrimitive.Root>
));
Switch.displayName = SwitchPrimitive.Root.displayName;

// Tabs
export const Tabs = TabsPrimitive.Root;
export const TabsList = React.forwardRef<
  React.ElementRef<typeof TabsPrimitive.List>,
  React.ComponentPropsWithoutRef<typeof TabsPrimitive.List>
>(({ className, ...props }, ref) => (
  <TabsPrimitive.List
    ref={ref}
    className={cn("inline-flex h-9 items-center justify-center gap-1 rounded-md bg-muted p-1 text-muted-foreground", className)}
    {...props}
  />
));
TabsList.displayName = TabsPrimitive.List.displayName;

export const TabsTrigger = React.forwardRef<
  React.ElementRef<typeof TabsPrimitive.Trigger>,
  React.ComponentPropsWithoutRef<typeof TabsPrimitive.Trigger>
>(({ className, ...props }, ref) => (
  <TabsPrimitive.Trigger
    ref={ref}
    className={cn(
      "inline-flex items-center justify-center whitespace-nowrap rounded px-3 py-1 text-xs font-medium transition-all focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring data-[state=active]:bg-background data-[state=active]:text-foreground data-[state=active]:shadow-sm",
      className
    )}
    {...props}
  />
));
TabsTrigger.displayName = TabsPrimitive.Trigger.displayName;

export const TabsContent = React.forwardRef<
  React.ElementRef<typeof TabsPrimitive.Content>,
  React.ComponentPropsWithoutRef<typeof TabsPrimitive.Content>
>(({ className, ...props }, ref) => (
  <TabsPrimitive.Content ref={ref} className={cn("focus-visible:outline-none", className)} {...props} />
));
TabsContent.displayName = TabsPrimitive.Content.displayName;

// Tooltip
export function TooltipProvider({ children }: { children: React.ReactNode }) {
  return <TooltipPrimitive.Provider delayDuration={200}>{children}</TooltipPrimitive.Provider>;
}
export function Tooltip({ content, children, side = "top" }: { content: React.ReactNode; children: React.ReactNode; side?: "top" | "bottom" | "left" | "right" }) {
  return (
    <TooltipPrimitive.Root>
      <TooltipPrimitive.Trigger asChild>{children as React.ReactElement}</TooltipPrimitive.Trigger>
      <TooltipPrimitive.Portal>
        <TooltipPrimitive.Content
          side={side}
          className="z-50 max-w-[260px] rounded-md border border-border bg-popover px-2.5 py-1.5 text-[11px] text-foreground shadow-md animate-in fade-in-0 zoom-in-95"
        >
          {content}
        </TooltipPrimitive.Content>
      </TooltipPrimitive.Portal>
    </TooltipPrimitive.Root>
  );
}

// InfoTip
export function InfoTip({ children, side = "top" }: { children: React.ReactNode; side?: "top" | "bottom" | "left" | "right" }) {
  return (
    <Tooltip content={<div className="whitespace-normal text-left leading-snug font-normal">{children}</div>} side={side}>
      <span tabIndex={0} className="inline-flex h-4 w-4 items-center justify-center rounded-full text-muted-foreground hover:text-foreground cursor-help">
        <Info size={12} />
      </span>
    </Tooltip>
  );
}

// Select
export function Select({
  value,
  onChange,
  options,
  className,
  placeholder,
}: {
  value: string;
  onChange: (v: string) => void;
  options: Array<string | { value: string; label: string }>;
  className?: string;
  placeholder?: string;
}) {
  return (
    <div className={cn("relative", className)}>
      <select
        value={value}
        onChange={(e) => onChange(e.target.value)}
        className="appearance-none h-9 w-full rounded-md border border-border bg-background pl-3 pr-8 text-sm focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
      >
        {placeholder && <option value="">{placeholder}</option>}
        {options.map((o) =>
          typeof o === "string" ? (
            <option key={o} value={o}>{o}</option>
          ) : (
            <option key={o.value} value={o.value}>{o.label}</option>
          )
        )}
      </select>
      <svg className="pointer-events-none absolute right-2.5 top-1/2 -translate-y-1/2 text-muted-foreground" width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
        <polyline points="6 9 12 15 18 9" />
      </svg>
    </div>
  );
}

// Skeleton
export function Skeleton({ className }: { className?: string }) {
  return <div className={cn("animate-pulse rounded-md bg-muted", className)} />;
}

// Sheet (right slide-in)
export function Sheet({
  open,
  onOpenChange,
  children,
  widthClass = "w-[480px]",
}: {
  open: boolean;
  onOpenChange: (v: boolean) => void;
  children: React.ReactNode;
  widthClass?: string;
}) {
  React.useEffect(() => {
    if (!open) return;
    const onKey = (e: KeyboardEvent) => e.key === "Escape" && onOpenChange(false);
    document.addEventListener("keydown", onKey);
    return () => document.removeEventListener("keydown", onKey);
  }, [open, onOpenChange]);

  return (
    <>
      <div
        onClick={() => onOpenChange(false)}
        className={cn("fixed inset-0 z-40 bg-black/40 backdrop-blur-[2px] transition-opacity", open ? "opacity-100" : "opacity-0 pointer-events-none")}
      />
      <div
        className={cn(
          "fixed right-0 top-0 bottom-0 z-50 max-w-full border-l border-border bg-background shadow-2xl transition-transform duration-200",
          widthClass,
          open ? "translate-x-0" : "translate-x-full"
        )}
      >
        <div className="flex h-full flex-col">{children}</div>
      </div>
    </>
  );
}

// Dialog
export function Dialog({
  open,
  onOpenChange,
  children,
  size = "md",
}: {
  open: boolean;
  onOpenChange: (v: boolean) => void;
  children: React.ReactNode;
  size?: "sm" | "md" | "lg" | "xl";
}) {
  React.useEffect(() => {
    if (!open) return;
    const onKey = (e: KeyboardEvent) => e.key === "Escape" && onOpenChange(false);
    document.addEventListener("keydown", onKey);
    return () => document.removeEventListener("keydown", onKey);
  }, [open, onOpenChange]);

  if (!open) return null;
  const widths = { sm: "max-w-md", md: "max-w-xl", lg: "max-w-3xl", xl: "max-w-5xl" };

  return (
    <div
      className="fixed inset-0 z-50 flex items-start justify-center overflow-y-auto p-4 md:p-8"
      onClick={() => onOpenChange(false)}
    >
      <div className="fixed inset-0 bg-black/50 backdrop-blur-[2px] animate-in fade-in" />
      <div
        onClick={(e) => e.stopPropagation()}
        className={cn("relative z-10 w-full rounded-lg border border-border bg-background shadow-xl animate-in fade-in zoom-in-95", widths[size])}
      >
        {children}
      </div>
    </div>
  );
}

// Toast system
interface Toast {
  id: string;
  variant?: "default" | "success" | "destructive";
  title: string;
  description?: string;
  duration?: number;
}

const ToastCtx = React.createContext<((t: Omit<Toast, "id">) => void) | null>(null);

export function ToastProvider({ children }: { children: React.ReactNode }) {
  const [toasts, setToasts] = React.useState<Toast[]>([]);
  const push = (toast: Omit<Toast, "id">) => {
    const id = Math.random().toString(36).slice(2);
    setToasts((ts) => [...ts, { id, ...toast }]);
    setTimeout(() => setToasts((ts) => ts.filter((t) => t.id !== id)), toast.duration || 3500);
  };
  return (
    <ToastCtx.Provider value={push}>
      {children}
      <div className="fixed bottom-4 right-4 z-[100] flex flex-col gap-2">
        {toasts.map((t) => (
          <div key={t.id} className="min-w-[280px] max-w-sm rounded-lg border border-border bg-background p-3 shadow-lg animate-in slide-in-from-right-2 fade-in">
            <div className="flex items-start gap-2.5">
              {t.variant === "destructive" ? (
                <svg className="mt-0.5 text-red-500 shrink-0" width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><path d="M10.29 3.86 1.82 18a2 2 0 0 0 1.71 3h16.94a2 2 0 0 0 1.71-3L13.71 3.86a2 2 0 0 0-3.42 0z"/><line x1="12" y1="9" x2="12" y2="13"/><line x1="12" y1="17" x2="12.01" y2="17"/></svg>
              ) : t.variant === "success" ? (
                <svg className="mt-0.5 text-emerald-500 shrink-0" width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><polyline points="20 6 9 17 4 12"/></svg>
              ) : (
                <svg className="mt-0.5 text-sky-500 shrink-0" width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><circle cx="12" cy="12" r="10"/><line x1="12" y1="16" x2="12" y2="12"/><line x1="12" y1="8" x2="12.01" y2="8"/></svg>
              )}
              <div className="min-w-0 flex-1">
                <div className="text-sm font-medium">{t.title}</div>
                {t.description && <div className="text-xs text-muted-foreground mt-0.5">{t.description}</div>}
              </div>
            </div>
          </div>
        ))}
      </div>
    </ToastCtx.Provider>
  );
}

export function useToast() {
  return React.useContext(ToastCtx)!;
}

// DateTimeRangePicker - Kibana-style time filter
interface DateRange {
  start: Date;
  end: Date;
  preset: string;
}

export function DateTimeRangePicker({ value, onChange, align = "right" }: { value: DateRange; onChange: (r: DateRange) => void; align?: "left" | "right" }) {
  const [open, setOpen] = React.useState(false);
  const [showCustom, setShowCustom] = React.useState(false);
  const [customStart, setCustomStart] = React.useState("");
  const [customEnd, setCustomEnd] = React.useState("");

  const presets = [
    { label: "Last 15 minutes", mins: 15 },
    { label: "Last 1 hour", mins: 60 },
    { label: "Last 24 hours", mins: 60 * 24 },
    { label: "Last 7 days", mins: 60 * 24 * 7 },
    { label: "Last 30 days", mins: 60 * 24 * 30 },
    { label: "Last 90 days", mins: 60 * 24 * 90 },
  ];

  const fmtISO = (d: Date) => {
    const pad = (n: number) => String(n).padStart(2, "0");
    const year = d.getFullYear();
    const month = pad(d.getMonth() + 1);
    const day = pad(d.getDate());
    const hours = pad(d.getHours());
    const minutes = pad(d.getMinutes());
    return `${year}-${month}-${day}T${hours}:${minutes}`;
  };

  const fmtDisplay = (d: Date) => {
    const pad = (n: number) => String(n).padStart(2, "0");
    return `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())} ${pad(d.getHours())}:${pad(d.getMinutes())}`;
  };

  const label = value.preset === "Custom" ? `${fmtDisplay(value.start)} → ${fmtDisplay(value.end)}` : value.preset;

  const applyPreset = (p: { label: string; mins: number }) => {
    const end = new Date();
    const start = new Date(end.getTime() - p.mins * 60 * 1000);
    onChange({ start, end, preset: p.label });
    setOpen(false);
    setShowCustom(false);
  };

  const applyCustom = () => {
    const start = new Date(customStart);
    const end = new Date(customEnd);
    if (!isNaN(start.getTime()) && !isNaN(end.getTime()) && start < end) {
      onChange({ start, end, preset: "Custom" });
      setOpen(false);
      setShowCustom(false);
    }
  };

  return (
    <div className="relative">
      <button
        onClick={() => setOpen(!open)}
        className="inline-flex items-center gap-2 h-8 px-3 rounded-md border border-border bg-transparent text-sm font-medium hover:bg-muted transition-colors"
      >
        <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><rect x="3" y="4" width="18" height="18" rx="2"/><line x1="16" y1="2" x2="16" y2="6"/><line x1="8" y1="2" x2="8" y2="6"/><line x1="3" y1="10" x2="21" y2="10"/></svg>
        <span className="font-mono text-[11px]">{label}</span>
        <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" className="opacity-50"><polyline points="6 9 12 15 18 9"/></svg>
      </button>

      {open && (
        <>
          <div className="fixed inset-0 z-40" onClick={() => setOpen(false)} />
          <div className={cn("absolute top-[calc(100%+4px)] z-50 w-[280px] rounded-lg border border-border bg-popover shadow-lg", align === "right" ? "right-0" : "left-0")}>
            {!showCustom ? (
              <div className="p-1">
                <div className="text-[10px] uppercase tracking-wide text-muted-foreground px-3 py-2">Quick select</div>
                {presets.map((p) => (
                  <button
                    key={p.label}
                    onClick={() => applyPreset(p)}
                    className={cn(
                      "w-full flex items-center gap-3 px-3 py-2 rounded-md text-xs font-medium transition-colors text-left",
                      value.preset === p.label
                        ? "bg-muted text-foreground"
                        : "text-muted-foreground hover:bg-muted hover:text-foreground"
                    )}
                  >
                    <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><rect x="3" y="4" width="18" height="18" rx="2"/><line x1="16" y1="2" x2="16" y2="6"/><line x1="8" y1="2" x2="8" y2="6"/><line x1="3" y1="10" x2="21" y2="10"/></svg>
                    {p.label}
                  </button>
                ))}
                <div className="border-t border-border my-1" />
                <button
                  onClick={() => {
                    setShowCustom(true);
                    setCustomStart(fmtISO(value.start));
                    setCustomEnd(fmtISO(value.end));
                  }}
                  className="w-full flex items-center gap-3 px-3 py-2 rounded-md text-xs font-medium text-muted-foreground hover:bg-muted hover:text-foreground transition-colors text-left"
                >
                  <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><circle cx="12" cy="12" r="3"/><path d="M12 1v6m0 6v6"/><path d="m4.93 4.93 4.24 4.24m5.66 5.66 4.24 4.24"/></svg>
                  Custom time range
                </button>
              </div>
            ) : (
              <div className="p-4">
                <div className="flex items-center justify-between mb-4">
                  <div className="text-sm font-semibold">Custom time range</div>
                  <button
                    onClick={() => setShowCustom(false)}
                    className="h-6 w-6 inline-flex items-center justify-center rounded-md hover:bg-muted text-muted-foreground hover:text-foreground"
                  >
                    <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><path d="M18 6 6 18"/><path d="m6 6 12 12"/></svg>
                  </button>
                </div>

                <div className="space-y-3">
                  <div>
                    <label className="text-[11px] font-medium block mb-1.5 text-muted-foreground">Start</label>
                    <input
                      type="datetime-local"
                      value={customStart}
                      onChange={(e) => setCustomStart(e.target.value)}
                      className="w-full h-9 rounded-md border border-border bg-background px-3 text-xs font-mono focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
                    />
                  </div>

                  <div>
                    <label className="text-[11px] font-medium block mb-1.5 text-muted-foreground">End</label>
                    <input
                      type="datetime-local"
                      value={customEnd}
                      onChange={(e) => setCustomEnd(e.target.value)}
                      className="w-full h-9 rounded-md border border-border bg-background px-3 text-xs font-mono focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
                    />
                  </div>
                </div>

                <div className="flex items-center justify-end gap-2 mt-4 pt-4 border-t border-border">
                  <button
                    onClick={() => setShowCustom(false)}
                    className="h-8 px-3 rounded-md text-xs font-medium hover:bg-muted text-muted-foreground"
                  >
                    Cancel
                  </button>
                  <button
                    onClick={applyCustom}
                    className="h-8 px-3 rounded-md bg-accent text-accent-fg text-xs font-medium hover:bg-accent/90"
                  >
                    Apply
                  </button>
                </div>
              </div>
            )}
          </div>
        </>
      )}
    </div>
  );
}
