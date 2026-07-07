import type { Metadata, Viewport } from 'next'
import { Inter } from 'next/font/google'
import { AppProviders } from '@/components/app-providers'
import './globals.css'

const inter = Inter({ subsets: ['latin'] })

export const viewport: Viewport = {
  width: 'device-width',
  initialScale: 1,
  maximumScale: 1,
  userScalable: false,
  viewportFit: 'cover',
  themeColor: [
    { media: '(prefers-color-scheme: light)', color: '#f8fafc' },
    { media: '(prefers-color-scheme: dark)', color: '#0f172a' }
  ]
}

export const metadata: Metadata = {
  title: 'MW-POS',
  description: 'Multi-tenant Distribution POS Platform',
  applicationName: 'MW-POS',
  appleWebApp: {
    capable: true,
    statusBarStyle: 'black-translucent',
    title: 'MW-POS'
  },
  formatDetection: {
    telephone: false
  },
  icons: {
    icon: '/MW_POS.png',
    shortcut: '/MW_POS.png',
    apple: '/MW_POS.png'
  },
  manifest: '/manifest.json'
}

export default function RootLayout ({
  children
}: {
  children: React.ReactNode
}) {
  return (
    <html lang='en'>
      <body className={`${inter.className} min-h-dvh`}>
        <AppProviders>{children}</AppProviders>
      </body>
    </html>
  )
}
