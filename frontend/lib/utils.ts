import { clsx, type ClassValue } from "clsx";
import { twMerge } from "tailwind-merge";

export function cn(...inputs: ClassValue[]) {
  return twMerge(clsx(inputs));
}

export function fmtNum(n: number | null | undefined, digits = 0): string {
  if (n == null) return "–";
  if (Math.abs(n) >= 1e6) return (n / 1e6).toFixed(1) + "M";
  if (Math.abs(n) >= 1e3) return (n / 1e3).toFixed(1) + "k";
  return n.toFixed(digits);
}

export function fmtUSD(n: number | null | undefined, d = 2): string {
  if (n == null) return "–";
  if (n < 0.01 && n > 0) return "$" + n.toFixed(6);
  if (n < 1) return "$" + n.toFixed(3);
  if (n < 1000) return "$" + n.toFixed(d);
  return "$" + fmtNum(n, 0);
}

export function fmtMs(ms: number | null | undefined): string {
  if (ms == null) return "–";
  if (ms < 1000) return ms + "ms";
  return (ms / 1000).toFixed(2) + "s";
}

export function fmtDate(iso: string): string {
  const d = new Date(iso);
  return d.toLocaleDateString(undefined, { month: "short", day: "numeric" });
}

export function fmtTime(iso: string): string {
  const d = new Date(iso);
  return d.toLocaleTimeString(undefined, { hour: "2-digit", minute: "2-digit", second: "2-digit" });
}

export function fmtDateTime(iso: string): string {
  const d = new Date(iso);
  const pad = (n: number) => String(n).padStart(2, "0");
  return `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())} ${pad(d.getHours())}:${pad(d.getMinutes())}:${pad(d.getSeconds())}`;
}

export function fmtDateTimeShort(iso: string): string {
  const d = new Date(iso);
  const month = d.toLocaleString(undefined, { month: "short" });
  const day = String(d.getDate()).padStart(2, "0");
  const pad = (n: number) => String(n).padStart(2, "0");
  return `${month} ${day}  ${pad(d.getHours())}:${pad(d.getMinutes())}:${pad(d.getSeconds())}`;
}

export function fmtToman(n: number | null | undefined): string {
  if (n == null) return "–";
  if (n >= 1_000_000) return (n / 1_000_000).toFixed(1) + "M T";
  if (n >= 10_000) return (n / 1_000).toFixed(0) + "k T";
  return n.toLocaleString(undefined, { maximumFractionDigits: 0 }) + " T";
}

export function fmtCost(
  usd: number | null | undefined,
  currency: string,
  rate: number,
  d?: number,
): string {
  if (currency === "IRT" && rate > 0) return fmtToman((usd ?? 0) * rate);
  return fmtUSD(usd, d);
}
