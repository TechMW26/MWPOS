import type { Metadata } from "next";
import { Inter } from "next/font/google";
import "./globals.css";

const inter = Inter({ subsets: ["latin"] });

export const metadata: Metadata = {
  title: "MW-POS",
  description: "Multi-tenant Distribution POS Platform",
  icons: {
    icon: "/MW_POS.png",
    shortcut: "/MW_POS.png",
    apple: "/MW_POS.png",
  },
  manifest: "/manifest.json",
};

export default function RootLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return (
    <html lang="en">
      <body className={`${inter.className} min-h-dvh`}>{children}</body>
    </html>
  );
}
