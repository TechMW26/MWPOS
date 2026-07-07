import type { Metadata } from 'next'

export const metadata: Metadata = {
  title: 'Offline — MW-POS'
}

export default function OfflineLayout ({
  children
}: {
  children: React.ReactNode
}) {
  return <>{children}</>
}
