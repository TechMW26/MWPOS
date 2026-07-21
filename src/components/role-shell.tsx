"use client";

import { usePathname } from "next/navigation";
import {
  BarChart3,
  Bell,
  BookOpen,
  Boxes,
  ClipboardCheck,
  House,
  LayoutDashboard,
  MapPin,
  Package,
  PackageSearch,
  ReceiptText,
  ScanBarcode,
  Settings,
  ShieldCheck,
  ShoppingBasket,
  ShoppingCart,
  Target,
  UserCircle,
  UserRoundCog,
  Users,
  Warehouse,
} from "lucide-react";
import { AppShell, type AppNavItem } from "@/components/app-shell";
import { MobileAppShell } from "@/components/mobile-app-shell";

interface RoleShellConfig {
  roleLabel: string;
  nav: AppNavItem[];
  bottomNav: AppNavItem[];
}

const configs: Record<string, RoleShellConfig> = {
  superadmin: makeConfig("Superadmin", [
    { href: "/superadmin/dashboard", label: "Dashboard", icon: LayoutDashboard },
    { href: "/superadmin/users", label: "Users", icon: UserRoundCog },
    { href: "/superadmin/store-managers", label: "ASMs", icon: ShieldCheck },
    { href: "/superadmin/cfs", label: "C&F Users", icon: Users },
    { href: "/superadmin/stores", label: "Distributors", icon: Warehouse },
    { href: "/superadmin/districts", label: "Districts", icon: MapPin },
    { href: "/superadmin/catalog", label: "Catalog", icon: Boxes },
    { href: "/superadmin/inventory", label: "Inventory", icon: ClipboardCheck },
    { href: "/superadmin/orders", label: "Orders", icon: ReceiptText },
    { href: "/superadmin/reports/khata", label: "Khata Book", icon: BookOpen },
    { href: "/superadmin/audit-logs", label: "Audit Logs", icon: ShieldCheck },
    { href: "/superadmin/settings", label: "Settings", icon: Settings },
  ], [0, 1, 3, 4, 8]),
  admin: makeConfig("Admin", [
    { href: "/admin/dashboard", label: "Dashboard", icon: LayoutDashboard },
    { href: "/admin/distributors", label: "Distributors", icon: Users },
    { href: "/admin/catalog", label: "Catalog", icon: Boxes },
    { href: "/admin/inventory", label: "Inventory", icon: ClipboardCheck },
    { href: "/admin/orders", label: "Orders", icon: ReceiptText },
    { href: "/admin/targets", label: "ASM Targets", icon: Target },
    { href: "/admin/reports/khata", label: "Khata Book", icon: BookOpen },
  ], [0, 1, 2, 3, 4]),
  manager: makeConfig("Store Manager", [
    { href: "/manager/dashboard", label: "Dashboard", icon: LayoutDashboard },
    { href: "/manager/marketplace", label: "Market", icon: ShoppingCart },
    { href: "/manager/customer-stores", label: "Stores", icon: Warehouse },
    { href: "/manager/inventory", label: "Inventory", icon: PackageSearch },
    { href: "/manager/orders", label: "Orders", icon: ReceiptText },
    { href: "/manager/pos", label: "POS", icon: ScanBarcode },
    { href: "/manager/reports/khata", label: "Khata", icon: BookOpen },
  ], [0, 1, 2, 3, 4]),
  storefront: makeConfig("Distributor", [
    { href: "/storefront/dashboard", label: "Home", icon: House },
    { href: "/storefront/marketplace", label: "Market", icon: ShoppingCart },
    { href: "/storefront/cart", label: "Cart", icon: ShoppingBasket },
    { href: "/storefront/orders", label: "Orders", icon: ReceiptText },
    { href: "/storefront/reports/khata", label: "Khata", icon: BookOpen },
    { href: "/storefront/inventory", label: "Stock", icon: PackageSearch },
    { href: "/storefront/pos", label: "POS", icon: ScanBarcode },
    { href: "/storefront/profile", label: "Profile", icon: UserCircle },
    { href: "/storefront/notifications", label: "Alerts", icon: Bell },
  ], [0, 1, 2, 3, 8]),
  asm: makeConfig("ASM Portal", [
    { href: "/asm/dashboard", label: "Home", icon: House },
    { href: "/asm/orders", label: "Orders", icon: ShoppingCart },
    { href: "/asm/distributors", label: "Distributors", icon: Users },
    { href: "/asm/pos", label: "Place Order", icon: ShoppingBasket },
    { href: "/asm/targets", label: "Targets", icon: Target },
    { href: "/asm/reports", label: "Reports", icon: BarChart3 },
    { href: "/asm/notifications", label: "Alerts", icon: Bell },
  ], [0, 3, 2, 4, 6]),
  cf: makeConfig("C&F Portal", [
    { href: "/cf/dashboard", label: "Home", icon: House },
    { href: "/cf/orders", label: "Orders", icon: ShoppingCart },
    { href: "/cf/place-order", label: "Place Order", icon: ShoppingBasket },
    { href: "/cf/asms", label: "ASMs", icon: Users },
    { href: "/cf/inventory", label: "Inventory", icon: Package },
    { href: "/cf/reports", label: "Reports", icon: BarChart3 },
    { href: "/cf/notifications", label: "Alerts", icon: Bell },
  ], [0, 1, 2, 3, 6]),
};

function makeConfig(roleLabel: string, nav: AppNavItem[], bottomIndexes: number[]): RoleShellConfig {
  return {
    roleLabel,
    nav,
    bottomNav: bottomIndexes.map((index) => nav[index]).filter((item): item is AppNavItem => Boolean(item)),
  };
}

function getPortal(pathname: string): keyof typeof configs {
  const segment = pathname.split("/").filter(Boolean)[0] || "storefront";
  return segment in configs ? segment : "storefront";
}

export function RoleShell({ children }: { children: React.ReactNode }) {
  const pathname = usePathname();
  const portal = getPortal(pathname);
  const config = configs[portal] ?? configs.storefront!;

  if (["storefront", "asm", "cf"].includes(portal)) {
    return <MobileAppShell nav={config.nav} bottomNav={config.bottomNav} roleLabel={config.roleLabel} notificationsHref={`/${portal}/notifications`}>
      {children}
    </MobileAppShell>;
  }

  return (
    <AppShell nav={config.nav} bottomNav={config.bottomNav} roleLabel={config.roleLabel}>
      {children}
    </AppShell>
  );
}
