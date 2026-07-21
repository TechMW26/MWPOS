"use client";

import { usePathname } from "next/navigation";
import {
  BarcodeIcon,
  BasketIcon,
  BellSimpleIcon,
  BookOpenTextIcon,
  BuildingsIcon,
  ChartBarIcon,
  ClipboardTextIcon,
  CrosshairIcon,
  GearIcon,
  HouseIcon,
  MapPinIcon,
  PackageIcon,
  ReceiptIcon,
  ShieldCheckIcon,
  ShoppingCartSimpleIcon,
  SquaresFourIcon,
  StackIcon,
  UserCircleIcon,
  UserGearIcon,
  UsersThreeIcon,
} from "@phosphor-icons/react";
import { AppShell, type AppNavItem } from "@/components/app-shell";
import { MobileAppShell } from "@/components/mobile-app-shell";

interface RoleShellConfig {
  roleLabel: string;
  nav: AppNavItem[];
  bottomNav: AppNavItem[];
}

const configs: Record<string, RoleShellConfig> = {
  superadmin: makeConfig("Superadmin", [
    { href: "/superadmin/dashboard", label: "Dashboard", icon: SquaresFourIcon },
    { href: "/superadmin/users", label: "Users", icon: UserGearIcon },
    { href: "/superadmin/store-managers", label: "ASMs", icon: ShieldCheckIcon },
    { href: "/superadmin/cfs", label: "C&F Users", icon: UsersThreeIcon },
    { href: "/superadmin/stores", label: "Distributors", icon: BuildingsIcon },
    { href: "/superadmin/districts", label: "Districts", icon: MapPinIcon },
    { href: "/superadmin/catalog", label: "Catalog", icon: StackIcon },
    { href: "/superadmin/inventory", label: "Inventory", icon: ClipboardTextIcon },
    { href: "/superadmin/orders", label: "Orders", icon: ReceiptIcon },
    { href: "/superadmin/reports/khata", label: "Khata Book", icon: BookOpenTextIcon },
    { href: "/superadmin/audit-logs", label: "Audit Logs", icon: ShieldCheckIcon },
    { href: "/superadmin/settings", label: "Settings", icon: GearIcon },
  ], [0, 1, 3, 4, 8]),
  admin: makeConfig("Admin", [
    { href: "/admin/dashboard", label: "Dashboard", icon: SquaresFourIcon },
    { href: "/admin/distributors", label: "Distributors", icon: BuildingsIcon },
    { href: "/admin/catalog", label: "Catalog", icon: StackIcon },
    { href: "/admin/inventory", label: "Inventory", icon: ClipboardTextIcon },
    { href: "/admin/orders", label: "Orders", icon: ReceiptIcon },
    { href: "/admin/targets", label: "ASM Targets", icon: CrosshairIcon },
    { href: "/admin/reports/khata", label: "Khata Book", icon: BookOpenTextIcon },
  ], [0, 1, 2, 3, 4]),
  manager: makeConfig("Store Manager", [
    { href: "/manager/dashboard", label: "Dashboard", icon: SquaresFourIcon },
    { href: "/manager/marketplace", label: "Market", icon: ShoppingCartSimpleIcon },
    { href: "/manager/customer-stores", label: "Stores", icon: BuildingsIcon },
    { href: "/manager/inventory", label: "Inventory", icon: PackageIcon },
    { href: "/manager/orders", label: "Orders", icon: ReceiptIcon },
    { href: "/manager/pos", label: "POS", icon: BarcodeIcon },
    { href: "/manager/reports/khata", label: "Khata", icon: BookOpenTextIcon },
  ], [0, 1, 2, 3, 4]),
  storefront: makeConfig("Distributor", [
    { href: "/storefront/dashboard", label: "Home", icon: HouseIcon },
    { href: "/storefront/marketplace", label: "Market", icon: ShoppingCartSimpleIcon },
    { href: "/storefront/cart", label: "Cart", icon: BasketIcon },
    { href: "/storefront/orders", label: "Orders", icon: ReceiptIcon },
    { href: "/storefront/reports/khata", label: "Khata", icon: BookOpenTextIcon },
    { href: "/storefront/inventory", label: "Stock", icon: PackageIcon },
    { href: "/storefront/pos", label: "POS", icon: BarcodeIcon },
    { href: "/storefront/profile", label: "Profile", icon: UserCircleIcon },
    { href: "/storefront/notifications", label: "Alerts", icon: BellSimpleIcon },
  ], [0, 1, 2, 3, 8]),
  asm: makeConfig("ASM Portal", [
    { href: "/asm/dashboard", label: "Home", icon: HouseIcon },
    { href: "/asm/orders", label: "Orders", icon: ReceiptIcon },
    { href: "/asm/distributors", label: "Distributors", icon: BuildingsIcon },
    { href: "/asm/pos", label: "Place Order", icon: BasketIcon },
    { href: "/asm/targets", label: "Targets", icon: CrosshairIcon },
    { href: "/asm/reports", label: "Reports", icon: ChartBarIcon },
    { href: "/asm/notifications", label: "Alerts", icon: BellSimpleIcon },
  ], [0, 3, 2, 4, 6]),
  cf: makeConfig("C&F Portal", [
    { href: "/cf/dashboard", label: "Home", icon: HouseIcon },
    { href: "/cf/orders", label: "Orders", icon: ReceiptIcon },
    { href: "/cf/place-order", label: "Place Order", icon: BasketIcon },
    { href: "/cf/asms", label: "ASMs", icon: UsersThreeIcon },
    { href: "/cf/inventory", label: "Inventory", icon: PackageIcon },
    { href: "/cf/reports", label: "Reports", icon: ChartBarIcon },
    { href: "/cf/notifications", label: "Alerts", icon: BellSimpleIcon },
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
