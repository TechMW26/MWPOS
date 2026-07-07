import type { Metadata, Viewport } from "next";
import { Inter } from "next/font/google";
import { ToastProvider } from "@/lib/hooks/use-toast";
import "./globals.css";

const inter = Inter({ subsets: ["latin"] });

export const viewport: Viewport = {
  width: "device-width",
  initialScale: 1,
  maximumScale: 1,
  themeColor: "#1d4ed8",
};

export const metadata: Metadata = {
  title: "MW-POS",
  description: "Multi-tenant Distribution & POS Platform",
  applicationName: "MW-POS",
  appleWebApp: {
    capable: true,
    statusBarStyle: "black-translucent",
    title: "MW-POS",
  },
  icons: {
    icon: "/icons/icon-192.png",
    shortcut: "/icons/icon-192.png",
    apple: "/icons/icon-192.png",
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
      <body className={`${inter.className} min-h-dvh`}>
        <ToastProvider>{children}</ToastProvider>
      </body>
    </html>
  );
}
