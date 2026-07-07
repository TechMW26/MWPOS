"use client";

import { AppShell, type AppNavItem } from "@/components/app-shell";
import { House, Store, ShoppingBasket, ReceiptText, PackageSearch, UserCircle, ScanBarcode, ShoppingCart, BookOpen } from "lucide-react";

const storefrontNav: AppNavItem[] = [
  { href: "/storefront/dashboard", label: "Home", icon: House },
  { href: "/storefront/marketplace", label: "Market", icon: ShoppingCart },
  { href: "/storefront/catalog", label: "Catalog", icon: Store },
  { href: "/storefront/cart", label: "Cart", icon: ShoppingBasket },
  { href: "/storefront/orders", label: "Orders", icon: ReceiptText },
  { href: "/storefront/reports/khata", label: "Khata", icon: BookOpen },
  { href: "/storefront/inventory", label: "Stock", icon: PackageSearch },
  { href: "/storefront/pos", label: "POS", icon: ScanBarcode },
  { href: "/storefront/profile", label: "Profile", icon: UserCircle },
];

const storefrontBottomNav = [
  storefrontNav[0]!,
  storefrontNav[1]!,
  storefrontNav[2]!,
  storefrontNav[3]!,
  storefrontNav[6]!,
];

export default function StorefrontLayout({ children }: { children: React.ReactNode }) {
  return <AppShell nav={storefrontNav} bottomNav={storefrontBottomNav} roleLabel="Storefront">{children}</AppShell>;
}
