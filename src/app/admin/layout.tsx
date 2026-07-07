"use client";

import { AppShell, type AppNavItem } from "@/components/app-shell";
import { LayoutDashboard, Warehouse, Boxes, ClipboardCheck, ReceiptText, BookOpen } from "lucide-react";

const adminNav: AppNavItem[] = [
  { href: "/admin/dashboard", label: "Dashboard", icon: LayoutDashboard },
  { href: "/admin/customer-stores", label: "Stores", icon: Warehouse },
  { href: "/admin/catalog", label: "Catalog", icon: Boxes },
  { href: "/admin/inventory", label: "Inventory", icon: ClipboardCheck },
  { href: "/admin/orders", label: "Orders", icon: ReceiptText },
  { href: "/admin/reports/khata", label: "Khata Book", icon: BookOpen },
];

const adminBottomNav = [
  adminNav[0]!,
  adminNav[1]!,
  adminNav[2]!,
  adminNav[3]!,
  adminNav[4]!,
];

export default function AdminLayout({ children }: { children: React.ReactNode }) {
  return <AppShell nav={adminNav} bottomNav={adminBottomNav} roleLabel="Admin">{children}</AppShell>;
}
