"use client";

import Image from "next/image";
import Link from "next/link";
import { usePathname, useRouter } from "next/navigation";
import { useEffect, useMemo, useState } from "react";
import { BellSimpleIcon, CaretRightIcon, ListIcon, SignOutIcon, XIcon } from "@phosphor-icons/react";
import type { AppNavItem } from "@/components/app-shell";
import { cn } from "@/lib/cn";

interface MobileAppShellProps {
  children: React.ReactNode;
  nav: AppNavItem[];
  bottomNav: AppNavItem[];
  roleLabel: string;
  notificationsHref: string;
}

export function MobileAppShell({ children, nav, bottomNav, roleLabel, notificationsHref }: MobileAppShellProps) {
  const pathname = usePathname();
  const router = useRouter();
  const [menuOpen, setMenuOpen] = useState(false);
  const [unread, setUnread] = useState(0);
  const activeItem = useMemo(
    () => nav.find((item) => pathname === item.href || pathname.startsWith(`${item.href}/`)) ?? nav[0],
    [nav, pathname]
  );

  useEffect(() => {
    let active = true;
    const load = () => fetch("/api/notifications?limit=1", { cache: "no-store" })
      .then((response) => response.ok ? response.json() : null)
      .then((payload) => { if (active) setUnread(Number(payload?.unreadCount) || 0); })
      .catch(() => undefined);
    load();
    const timer = window.setInterval(load, 30_000);
    return () => { active = false; window.clearInterval(timer); };
  }, [pathname]);

  async function signOut() {
    try {
      const [{ signOut: firebaseSignOut }, { getFirebaseAuth }] = await Promise.all([
        import("firebase/auth"), import("@/lib/db/client"),
      ]);
      await firebaseSignOut(getFirebaseAuth());
    } catch { /* session logout below is authoritative */ }
    await fetch("/api/auth/logout", { method: "POST" }).catch(() => undefined);
    router.push("/login");
  }

  return (
    <div data-mw-app-shell className="min-h-dvh bg-slate-100 text-foreground">
      <div className="relative mx-auto min-h-dvh max-w-[520px] bg-background shadow-[0_0_48px_rgba(15,23,42,0.08)]">
        <header className="sticky top-0 z-30 px-3 pt-[max(0.75rem,env(safe-area-inset-top))]">
          <div className="flex h-14 items-center gap-3 rounded-full border border-white/70 bg-white/90 px-2.5 shadow-[0_10px_30px_rgba(15,23,42,0.12)] backdrop-blur-xl">
            <Link href={nav[0]?.href ?? "/"} className="flex h-10 w-10 shrink-0 items-center justify-center overflow-hidden rounded-full bg-slate-50" aria-label="Home">
              <Image src="/MW_POS.png" alt="MW-POS" width={38} height={38} className="h-9 w-9 object-contain" priority />
            </Link>
            <div className="min-w-0 flex-1">
              <p className="truncate text-[10px] font-bold uppercase tracking-[0.16em] text-primary">{roleLabel}</p>
              <h1 className="truncate text-[15px] font-bold leading-tight">{activeItem?.label ?? "Home"}</h1>
            </div>
            <Link href={notificationsHref} className="relative flex h-10 w-10 items-center justify-center rounded-full bg-slate-100 transition active:scale-95" aria-label={`${unread} unread notifications`}>
              <BellSimpleIcon className="h-5 w-5" weight="bold" />
              {unread > 0 && <span className="absolute right-0 top-0 min-w-4 rounded-full bg-red-500 px-1 text-center text-[10px] font-bold leading-4 text-white">{unread > 9 ? "9+" : unread}</span>}
            </Link>
            <button type="button" onClick={() => setMenuOpen(true)} className="flex h-10 w-10 items-center justify-center rounded-full bg-slate-950 text-white transition active:scale-95" aria-label="Open menu">
              <ListIcon className="h-5 w-5" weight="bold" />
            </button>
          </div>
        </header>

        <main className="px-3 pb-28 pt-4">
          <div key={pathname} className="animate-page-enter">{children}</div>
        </main>

        <nav className="fixed bottom-[max(0.75rem,env(safe-area-inset-bottom))] left-1/2 z-30 w-[calc(100%-1.5rem)] max-w-[496px] -translate-x-1/2 rounded-[1.75rem] border border-white/70 bg-slate-950/95 p-1.5 shadow-[0_18px_45px_rgba(15,23,42,0.35)] backdrop-blur-xl" aria-label="Primary navigation">
          <div className="grid grid-cols-5 gap-1">
            {bottomNav.slice(0, 5).map((item) => {
              const active = pathname === item.href || pathname.startsWith(`${item.href}/`);
              return <Link key={item.href} href={item.href} className={cn("flex min-w-0 flex-col items-center gap-0.5 rounded-[1.3rem] px-1 py-2 text-[10px] font-semibold transition active:scale-95", active ? "bg-white text-slate-950 shadow-sm" : "text-slate-400 hover:text-white")} aria-current={active ? "page" : undefined}>
                <item.icon className="h-5 w-5" weight={active ? "fill" : "regular"} />
                <span className="max-w-full truncate">{item.label}</span>
              </Link>;
            })}
          </div>
        </nav>

        {menuOpen && <div className="fixed inset-0 z-50 animate-overlay bg-slate-950/35 backdrop-blur-sm" onClick={() => setMenuOpen(false)}>
          <aside className="absolute inset-y-0 right-0 flex w-[min(86vw,360px)] animate-drawer-right flex-col rounded-l-[2rem] bg-white p-4 shadow-2xl" onClick={(event) => event.stopPropagation()}>
            <div className="flex items-center justify-between px-1 py-2">
              <div><p className="text-xs font-bold uppercase tracking-wider text-primary">MW-POS</p><p className="text-lg font-bold">{roleLabel}</p></div>
              <button type="button" onClick={() => setMenuOpen(false)} className="flex h-11 w-11 items-center justify-center rounded-full bg-slate-100" aria-label="Close menu"><XIcon className="h-5 w-5" weight="bold" /></button>
            </div>
            <div className="mt-5 flex-1 space-y-1 overflow-auto">
              {nav.map((item) => {
                const active = pathname === item.href || pathname.startsWith(`${item.href}/`);
                return <Link key={item.href} href={item.href} onClick={() => setMenuOpen(false)} className={cn("flex min-h-12 items-center gap-3 rounded-2xl px-3 text-sm font-semibold", active ? "bg-primary text-primary-foreground" : "hover:bg-slate-100")}>
                  <item.icon className="h-5 w-5" weight={active ? "fill" : "regular"} /><span className="flex-1">{item.label}</span><CaretRightIcon className="h-4 w-4 opacity-50" weight="bold" />
                </Link>;
              })}
            </div>
            <button type="button" onClick={signOut} className="mt-4 flex min-h-12 items-center gap-3 rounded-2xl border px-3 text-sm font-semibold text-red-600"><SignOutIcon className="h-5 w-5" weight="bold" />Sign out</button>
          </aside>
        </div>}
      </div>
    </div>
  );
}
