"use client";

import { AppShell, type AppNavItem } from "@/components/app-shell";
import { LayoutDashboard, Warehouse, PackageSearch, ReceiptText, ScanBarcode, ShoppingCart, BookOpen } from "lucide-react";

const managerNav: AppNavItem[] = [
  { href: "/manager/dashboard", label: "Dashboard", icon: LayoutDashboard },
  { href: "/manager/marketplace", label: "Market", icon: ShoppingCart },
  { href: "/manager/customer-stores", label: "Stores", icon: Warehouse },
  { href: "/manager/inventory", label: "Inventory", icon: PackageSearch },
  { href: "/manager/orders", label: "Orders", icon: ReceiptText },
  { href: "/manager/pos", label: "POS", icon: ScanBarcode },
  { href: "/manager/reports/khata", label: "Khata", icon: BookOpen },
];

const managerBottomNav = [
  managerNav[0]!,
  managerNav[2]!,
  managerNav[3]!,
  managerNav[4]!,
  managerNav[1]!,
];

export default function ManagerLayout({ children }: { children: React.ReactNode }) {
  return <AppShell nav={managerNav} bottomNav={managerBottomNav} roleLabel="Store Manager">{children}</AppShell>;
}
