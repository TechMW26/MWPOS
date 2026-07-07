"use client";

import { AppShell, type AppNavItem } from "@/components/app-shell";
import {
  LayoutDashboard,
  UserRoundCog,
  Warehouse,
  Boxes,
  ClipboardCheck,
  Settings,
  ShieldCheck,
  ReceiptText,
} from "lucide-react";

const superadminNav: AppNavItem[] = [
  { href: "/superadmin/dashboard", label: "Dashboard", icon: LayoutDashboard },
  { href: "/superadmin/users", label: "Users", icon: UserRoundCog },
  { href: "/superadmin/store-managers", label: "Store Managers", icon: ShieldCheck },
  { href: "/superadmin/stores", label: "Stores", icon: Warehouse },
  { href: "/superadmin/catalog", label: "Catalog", icon: Boxes },
  { href: "/superadmin/inventory", label: "Inventory", icon: ClipboardCheck },
  { href: "/superadmin/orders", label: "Orders", icon: ReceiptText },
  { href: "/superadmin/settings", label: "Settings", icon: Settings },
];

const superadminBottomNav = [
  superadminNav[0]!,
  superadminNav[1]!,
  superadminNav[3]!,
  superadminNav[4]!,
  superadminNav[6]!,
];

export default function SuperadminLayout({ children }: { children: React.ReactNode }) {
  return <AppShell nav={superadminNav} bottomNav={superadminBottomNav} roleLabel="Superadmin">{children}</AppShell>;
}
