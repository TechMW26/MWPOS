"use client";

import Link from "next/link";
import { useEffect, useState } from "react";
import { Bell, CheckCheck, ChevronRight, Loader2 } from "lucide-react";
import { Button } from "@/components/ui/button";
import type { Notification } from "@/types/models";

export function NotificationCenter() {
  const [items, setItems] = useState<Notification[]>([]);
  const [loading, setLoading] = useState(true);

  async function load() {
    const response = await fetch("/api/notifications", { cache: "no-store" });
    const payload = await response.json();
    setItems(Array.isArray(payload.notifications) ? payload.notifications : []);
    setLoading(false);
  }

  useEffect(() => { load().catch(() => setLoading(false)); }, []);

  async function markRead(id?: string) {
    await fetch("/api/notifications", { method: "PATCH", headers: { "Content-Type": "application/json" }, body: JSON.stringify(id ? { id } : { all: true }) });
    setItems((current) => current.map((item) => !id || item.id === id ? { ...item, read: true } : item));
  }

  return <div className="space-y-4">
    <div className="flex items-center justify-between px-1">
      <div><h2 className="text-xl font-bold">Notifications</h2><p className="text-sm text-muted-foreground">Orders, approvals and account updates</p></div>
      {items.some((item) => !item.read) && <Button variant="ghost" size="sm" onClick={() => markRead()}><CheckCheck className="mr-1.5 h-4 w-4" />Read all</Button>}
    </div>
    {loading ? <div className="flex min-h-40 items-center justify-center text-muted-foreground"><Loader2 className="mr-2 h-5 w-5 animate-spin" />Loading alerts</div> : items.length === 0 ? <div className="rounded-[1.5rem] border bg-white p-10 text-center shadow-sm"><Bell className="mx-auto mb-3 h-10 w-10 text-slate-300" /><p className="font-bold">You’re all caught up</p><p className="mt-1 text-sm text-muted-foreground">New activity will appear here.</p></div> : <div className="space-y-2">
      {items.map((item) => {
        const content = <div className={`flex min-h-24 items-start gap-3 rounded-[1.4rem] border p-4 transition active:scale-[0.99] ${item.read ? "bg-white" : "border-primary/25 bg-primary/[0.04] shadow-sm"}`}>
          <span className={`mt-1 h-2.5 w-2.5 shrink-0 rounded-full ${item.read ? "bg-slate-200" : "bg-primary"}`} />
          <span className="min-w-0 flex-1"><span className="block font-bold leading-tight">{item.title}</span><span className="mt-1 block text-sm leading-snug text-muted-foreground">{item.body}</span><span className="mt-2 block text-xs text-muted-foreground">{new Date(item.createdAt).toLocaleString("en-IN", { day: "numeric", month: "short", hour: "numeric", minute: "2-digit" })}</span></span>
          {item.link && <ChevronRight className="mt-1 h-5 w-5 shrink-0 text-muted-foreground" />}
        </div>;
        return item.link ? <Link key={item.id} href={item.link} onClick={() => markRead(item.id)}>{content}</Link> : <button key={item.id} type="button" className="w-full text-left" onClick={() => markRead(item.id)}>{content}</button>;
      })}
    </div>}
  </div>;
}
