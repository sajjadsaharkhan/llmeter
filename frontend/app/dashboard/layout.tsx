"use client";
import { useState, useEffect } from "react";
import { useRouter } from "next/navigation";
import { Sidebar, MobileTabBar } from "@/components/shell/Sidebar";

export default function DashboardLayout({ children }: { children: React.ReactNode }) {
  const [collapsed, setCollapsed] = useState(false);
  const router = useRouter();

  useEffect(() => {
    const token = localStorage.getItem("llmeter_token");
    if (!token) router.replace("/login");
  }, [router]);

  return (
    <div className="h-screen flex bg-background overflow-hidden">
      <Sidebar collapsed={collapsed} setCollapsed={setCollapsed} />
      <main className="flex-1 min-w-0 flex flex-col pb-16 md:pb-0">
        <div className="flex-1 overflow-y-auto">
          {children}
        </div>
      </main>
      <MobileTabBar />
    </div>
  );
}
