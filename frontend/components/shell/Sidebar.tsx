"use client";
import Link from "next/link";
import { usePathname, useRouter } from "next/navigation";
import { LayoutDashboard, Server, ScrollText, Settings, LogOut, PanelLeft, Gauge, Cable } from "lucide-react";
import { cn } from "@/lib/utils";
import { clearToken } from "@/lib/api";

const NAV = [
  { href: "/dashboard", label: "Dashboard", icon: LayoutDashboard },
  { href: "/dashboard/providers", label: "Providers", icon: Server },
  { href: "/dashboard/logs", label: "Request Logs", icon: ScrollText },
  { href: "/dashboard/connect", label: "Connect", icon: Cable },
  { href: "/dashboard/settings", label: "Settings", icon: Settings },
];

interface SidebarProps {
  collapsed: boolean;
  setCollapsed: (v: boolean) => void;
}

export function Sidebar({ collapsed, setCollapsed }: SidebarProps) {
  const pathname = usePathname();
  const router = useRouter();

  const handleLogout = () => {
    clearToken();
    router.push("/login");
  };

  return (
    <aside
      className={cn(
        "h-screen hidden md:flex shrink-0 flex-col border-r border-border bg-background transition-[width] duration-200",
        collapsed ? "w-[60px]" : "w-[232px]"
      )}
    >
      {/* Logo */}
      <div className={cn("flex h-16 items-center border-b border-border", collapsed ? "justify-center px-0" : "px-4")}>
        <div className="flex items-center gap-2">
          <div className="flex h-7 w-7 items-center justify-center rounded-md bg-accent text-accent-fg shrink-0">
            <Gauge size={16} />
          </div>
          {!collapsed && <span className="text-[14px] font-semibold tracking-tight">LLMeter</span>}
        </div>
      </div>

      {/* Nav */}
      <nav className={cn("flex-1 py-3 flex flex-col gap-0.5", collapsed ? "px-2" : "px-3")}>
        {NAV.map((n) => {
          const active = pathname === n.href || (n.href !== "/dashboard" && pathname.startsWith(n.href));
          const Icon = n.icon;
          return (
            <Link
              key={n.href}
              href={n.href}
              className={cn(
                "group flex items-center gap-2.5 rounded-md text-sm font-medium transition-colors",
                collapsed ? "h-9 w-9 justify-center" : "h-8 px-2.5",
                active ? "bg-accent-soft text-accent" : "text-muted-foreground hover:text-accent hover:bg-accent/10"
              )}
            >
              <Icon size={16} strokeWidth={active ? 2 : 1.75} />
              {!collapsed && <span>{n.label}</span>}
            </Link>
          );
        })}
      </nav>

      {/* Collapse toggle */}
      <div className={cn("border-t border-border p-2", collapsed ? "flex justify-center" : "")}>
        <button
          onClick={() => setCollapsed(!collapsed)}
          className={cn(
            "flex items-center gap-2 rounded-md text-xs font-medium text-muted-foreground hover:text-foreground hover:bg-muted/60 transition-colors",
            collapsed ? "h-9 w-9 justify-center" : "h-8 w-full px-2.5"
          )}
        >
          <PanelLeft size={15} />
          {!collapsed && <span>Collapse</span>}
        </button>
      </div>

      {/* User */}
      <div className={cn("border-t border-border p-2.5", collapsed ? "flex flex-col items-center gap-1.5" : "")}>
        {!collapsed ? (
          <div className="flex items-center gap-2.5 rounded-md px-1.5 py-1.5">
            <div className="flex h-7 w-7 items-center justify-center rounded-full bg-accent text-accent-fg text-[11px] font-semibold shrink-0">
              A
            </div>
            <div className="flex-1 min-w-0">
              <div className="text-xs font-medium truncate">admin</div>
              <div className="text-[10px] text-muted-foreground truncate">Administrator</div>
            </div>
            <button onClick={handleLogout} title="Sign out"
              className="h-7 w-7 inline-flex items-center justify-center rounded-md text-muted-foreground hover:text-accent hover:bg-accent/10">
              <LogOut size={14} />
            </button>
          </div>
        ) : (
          <>
            <div className="flex h-7 w-7 items-center justify-center rounded-full bg-accent text-accent-fg text-[11px] font-semibold">A</div>
            <button onClick={handleLogout} className="h-7 w-7 inline-flex items-center justify-center rounded-md text-muted-foreground hover:text-accent hover:bg-accent/10">
              <LogOut size={14} />
            </button>
          </>
        )}
      </div>
    </aside>
  );
}

export function MobileTabBar() {
  const pathname = usePathname();
  return (
    <nav className="md:hidden fixed bottom-0 inset-x-0 z-30 border-t border-border bg-background">
      <div className="grid grid-cols-5">
        {NAV.map((n) => {
          const Icon = n.icon;
          const active = pathname === n.href || (n.href !== "/dashboard" && pathname.startsWith(n.href));
          return (
            <Link key={n.href} href={n.href}
              className={cn("flex flex-col items-center gap-1 py-2.5 text-[10px] font-medium", active ? "text-foreground" : "text-muted-foreground")}>
              <Icon size={18} strokeWidth={active ? 2 : 1.75} />
              <span>{n.label.split(" ")[0]}</span>
            </Link>
          );
        })}
      </div>
    </nav>
  );
}

export function Topbar({ title, subtitle, right }: { title: string; subtitle?: string; right?: React.ReactNode }) {
  return (
    <header className="sticky top-0 z-20 h-16 flex items-center gap-3 border-b border-border bg-background/95 backdrop-blur px-4 md:px-6 shrink-0">
      <div className="min-w-0 flex-1">
        <h1 className="text-[15px] font-semibold tracking-tight truncate">{title}</h1>
        {subtitle && <p className="text-[11.5px] text-muted-foreground truncate mt-0.5">{subtitle}</p>}
      </div>
      <div className="flex items-center gap-2">{right}</div>
    </header>
  );
}
