"use client";

import Link from "next/link";
import Image from "next/image";
import { usePathname } from "next/navigation";
import { useEffect, useMemo, useRef, useState } from "react";
import type { Icon } from "@phosphor-icons/react";
import { LogOut, Menu, Search, X } from "lucide-react";
import { cn } from "@/lib/cn";
import { useRouter } from "next/navigation";

export interface AppNavItem {
  href: string;
  label: string;
  icon: Icon;
}

interface AppShellProps {
  children: React.ReactNode;
  nav: AppNavItem[];
  bottomNav?: AppNavItem[];
  roleLabel: string;
}

export function AppShell({ children, nav, bottomNav, roleLabel }: AppShellProps) {
  const pathname = usePathname();
  const [menuOpen, setMenuOpen] = useState(false);
  const [menuClosing, setMenuClosing] = useState(false);
  const [search, setSearch] = useState("");
  const [searchOpen, setSearchOpen] = useState(false);
  const [results, setResults] = useState<Array<{ label: string; type: string; href: string; hint?: string }>>([]);
  const searchBoxRef = useRef<HTMLDivElement>(null);
  const mobileNav = (bottomNav ?? nav).slice(0, 5);
  const activeItem = useMemo(
    () => nav.find((item) => pathname === item.href || pathname.startsWith(`${item.href}/`)) ?? nav[0],
    [nav, pathname]
  );
  const routeFor = (kind: "product" | "store" | "order") => {
    const fallback = activeItem?.href ?? nav[0]?.href ?? "/";
    if (kind === "product") return nav.find((item) => /catalog/i.test(item.label))?.href ?? fallback;
    if (kind === "store") return nav.find((item) => /store/i.test(item.label))?.href ?? fallback;
    return nav.find((item) => /order/i.test(item.label))?.href ?? fallback;
  };
  function openMenu() {
    setMenuClosing(false);
    setMenuOpen(true);
  }

  function closeMenu() {
    setMenuClosing(true);
    window.setTimeout(() => {
      setMenuOpen(false);
      setMenuClosing(false);
    }, 180);
  }

  useEffect(() => {
    function closeOnOutsideClick(event: MouseEvent) {
      if (!searchBoxRef.current?.contains(event.target as Node)) setSearchOpen(false);
    }
    document.addEventListener("mousedown", closeOnOutsideClick);
    return () => document.removeEventListener("mousedown", closeOnOutsideClick);
  }, []);

  useEffect(() => {
    const query = search.trim().toLowerCase();
    if (query.length < 2) {
      setResults([]);
      return;
    }
    const timer = window.setTimeout(async () => {
      const next: Array<{ label: string; type: string; href: string; hint?: string }> = [];
      const [products, stores] = await Promise.all([
        fetch("/api/products").then((r) => r.ok ? r.json() : []).catch(() => []),
        fetch("/api/stores").then((r) => r.ok ? r.json() : []).catch(() => []),
      ]);
      if (Array.isArray(products)) {
        products
          .filter((product) => String(product.name ?? "").toLowerCase().includes(query) || String(product.id ?? "").toLowerCase().includes(query))
          .slice(0, 4)
          .forEach((product) => next.push({ label: product.name ?? product.id, type: "Product", href: routeFor("product"), hint: product.category }));
      }
      if (Array.isArray(stores)) {
        stores
          .filter((store) => String(store.name ?? "").toLowerCase().includes(query) || String(store.id ?? "").toLowerCase().includes(query))
          .slice(0, 4)
          .forEach((store) => next.push({ label: store.name ?? store.id, type: "Store", href: routeFor("store"), hint: store.type }));
      }
      if (query.length >= 4) {
        next.push({ label: `Search orders for "${search.trim()}"`, type: "Orders", href: routeFor("order"), hint: "Open order list" });
      }
      setResults(next.slice(0, 8));
      setSearchOpen(true);
    }, 180);
    return () => window.clearTimeout(timer);
  }, [search, nav]);

  return (
    <div data-mw-app-shell className="min-h-dvh bg-background text-foreground">
      <aside className="fixed inset-y-0 left-0 z-30 hidden w-72 border-r bg-card/95 px-4 py-5 shadow-sm backdrop-blur lg:flex lg:flex-col">
        <Brand roleLabel={roleLabel} />
        <NavList nav={nav} pathname={pathname} className="mt-6 flex-1" />
        <SignOutLink />
      </aside>

      <header className="sticky top-0 z-20 border-b bg-background/90 backdrop-blur lg:ml-72">
        <div className="flex h-16 items-center gap-3 px-4 sm:px-6">
          <MobileLogo />
          <div className="min-w-0 flex-1">
            <p className="text-xs font-medium uppercase tracking-wide text-muted-foreground">{roleLabel}</p>
            <h1 className="truncate text-lg font-semibold sm:text-xl">{activeItem?.label ?? "Dashboard"}</h1>
          </div>
          <div ref={searchBoxRef} className="relative hidden min-w-80 md:block">
            <form
              onSubmit={(event) => {
                event.preventDefault();
                const first = results[0];
                if (first) window.location.href = first.href;
              }}
              className="flex items-center gap-2 rounded-md border bg-muted/40 px-3 py-2 text-sm text-muted-foreground transition-colors focus-within:border-primary focus-within:bg-background"
            >
              <Search className="h-4 w-4" />
              <input
                value={search}
                onChange={(event) => setSearch(event.target.value)}
                onFocus={() => setSearchOpen(true)}
                placeholder="Search products, orders, stores..."
                aria-label="Search products, orders, stores"
                className="w-full bg-transparent outline-none placeholder:text-muted-foreground"
              />
            </form>
            {searchOpen && search.trim().length >= 2 && (
              <div className="absolute right-0 top-12 z-50 w-full overflow-hidden rounded-lg border bg-card shadow-lg animate-in">
                {results.length ? results.map((result, index) => (
                  <Link
                    key={`${result.type}-${result.label}-${index}`}
                    href={result.href}
                    onClick={() => setSearchOpen(false)}
                    className="block px-3 py-2 text-sm transition-colors hover:bg-muted"
                  >
                    <span className="font-medium">{result.label}</span>
                    <span className="ml-2 text-xs text-muted-foreground">{result.type}{result.hint ? ` · ${result.hint}` : ""}</span>
                  </Link>
                )) : (
                  <div className="px-3 py-3 text-sm text-muted-foreground">No matching products or stores.</div>
                )}
              </div>
            )}
          </div>
          <button
            type="button"
            aria-label="Open navigation"
            title="Open navigation"
            onClick={openMenu}
            className="inline-flex h-11 w-11 items-center justify-center text-muted-foreground transition-all hover:text-foreground active:scale-95 lg:hidden"
          >
            <Menu className="h-7 w-7 stroke-[2.2]" />
          </button>
        </div>
      </header>

      {menuOpen && (
        <div className="fixed inset-0 z-40 lg:hidden">
          <button
            type="button"
            aria-label="Close navigation overlay"
            className={cn("absolute inset-0 bg-foreground/30", menuClosing ? "animate-overlay-out" : "animate-overlay")}
            onClick={closeMenu}
          />
          <aside className={cn("relative ml-auto flex h-full w-[min(86vw,20rem)] flex-col border-l bg-card p-4 shadow-xl", menuClosing ? "animate-drawer-right-out" : "animate-drawer-right")}>
            <div className="flex items-start justify-between gap-3">
              <Brand roleLabel={roleLabel} />
              <button
                type="button"
                aria-label="Close navigation"
                title="Close navigation"
                onClick={closeMenu}
                className="inline-flex h-10 w-10 items-center justify-center text-muted-foreground transition-all hover:text-foreground active:scale-95"
              >
                <X className="h-7 w-7 stroke-[2.2]" />
              </button>
            </div>
            <NavList nav={nav} pathname={pathname} onNavigate={closeMenu} className="mt-6 flex-1" />
            <SignOutLink />
          </aside>
        </div>
      )}

      <main className="lg:ml-72">
        <div className="w-full p-3 pb-24 sm:p-4 sm:pb-24 lg:p-4">
          {children}
        </div>
      </main>

      <nav className="fixed inset-x-0 bottom-0 z-30 border-t bg-card/95 px-2 pb-[max(0.5rem,env(safe-area-inset-bottom))] pt-2 shadow-[0_-8px_24px_rgba(15,23,42,0.08)] backdrop-blur lg:hidden">
        <div className="grid grid-cols-5 gap-1">
          {mobileNav.map((item) => {
            const active = pathname === item.href || pathname.startsWith(`${item.href}/`);
            return (
              <Link
                key={item.href}
                href={item.href}
                title={item.label}
                aria-label={item.label}
                className={cn(
                  "flex min-w-0 flex-col items-center gap-1 rounded-xl px-1.5 py-2 text-[11px] font-semibold text-muted-foreground transition-all active:scale-95",
                  active ? "bg-primary text-primary-foreground shadow-sm" : "hover:bg-muted hover:text-foreground"
                )}
              >
                <item.icon className="h-6 w-6 stroke-[2.2]" />
                <span className="max-w-20 truncate">{item.label}</span>
              </Link>
            );
          })}
        </div>
      </nav>
    </div>
  );
}

function MobileLogo() {
  return (
    <Link href="/" className="flex h-11 w-11 items-center justify-center overflow-hidden lg:hidden" title="Home">
      <Image src="/MW_POS.png" alt="MW-POS" width={44} height={44} className="h-full w-full object-contain" priority />
    </Link>
  );
}

function Brand({ roleLabel }: { roleLabel: string }) {
  return (
    <Link href="/" className="block" title="Go to home">
      <div className="flex items-center gap-3">
        <div className="flex h-11 w-11 items-center justify-center overflow-hidden">
          <Image src="/MW_POS.png" alt="MW-POS" width={44} height={44} className="h-full w-full object-contain" />
        </div>
        <div>
          <p className="text-lg font-bold leading-tight">MW-POS</p>
          <p className="text-xs text-muted-foreground">{roleLabel}</p>
        </div>
      </div>
    </Link>
  );
}

function NavList({
  nav,
  pathname,
  className,
  onNavigate,
}: {
  nav: AppNavItem[];
  pathname: string;
  className?: string;
  onNavigate?: () => void;
}) {
  return (
    <nav className={cn("space-y-1 overflow-y-auto pr-1", className)} aria-label="Primary navigation">
      {nav.map((item) => {
        const active = pathname === item.href || pathname.startsWith(`${item.href}/`);
        return (
          <Link
            key={item.href}
            href={item.href}
            title={item.label}
            onClick={onNavigate}
            className={cn(
              "flex items-center gap-3 rounded-md px-3 py-2.5 text-sm font-medium transition-colors",
              active
                ? "bg-primary text-primary-foreground shadow-sm"
                : "text-muted-foreground hover:bg-muted hover:text-foreground"
            )}
          >
            <item.icon className="h-4 w-4 shrink-0" />
            <span className="truncate">{item.label}</span>
          </Link>
        );
      })}
    </nav>
  );
}

function SignOutLink() {
  const router = useRouter();

  async function handleSignOut() {
    try {
      const [{ signOut }, { getFirebaseAuth }] = await Promise.all([
        import("firebase/auth"),
        import("@/lib/db/client"),
      ]);
      await signOut(getFirebaseAuth());
    } catch { /* ignore */ }
    try {
      await fetch("/api/auth/logout", { method: "POST" });
    } catch { /* ignore */ }
    router.push("/login");
  }

  return (
    <button
      onClick={handleSignOut}
      title="Sign out"
      className="mt-4 flex items-center gap-3 rounded-md border px-3 py-2.5 text-sm font-medium text-muted-foreground transition-colors hover:bg-muted hover:text-foreground w-full text-left"
    >
      <LogOut className="h-4 w-4" />
      Sign Out
    </button>
  );
}
