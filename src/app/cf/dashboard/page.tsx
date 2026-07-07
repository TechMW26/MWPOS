'use client'

import { StatCard } from '@/components/ui/stat-card'
import { ShoppingCart, Users, Package, ClipboardCheck } from 'lucide-react'
import { useEffect, useState } from 'react'

export default function CfDashboard() {
  const [stats, setStats] = useState({ orders: 0, pending: 0, asms: 0 })

  useEffect(() => {
    async function load() {
      try {
        const res = await fetch('/api/orders')
        if (res.ok) {
          const orders = await res.json()
          setStats({
            orders: orders.length,
            pending: orders.filter((o: any) => o.status === 'PENDING_CF_APPROVAL').length,
            asms: 0,
          })
        }
      } catch { /* ignore */ }
    }
    load()
  }, [])

  return (
    <div className="space-y-6">
      <p className="text-muted-foreground">Carry &amp; Forward — Approve orders &amp; manage ASMs</p>

      <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-4">
        <StatCard title="Orders" value={stats.orders} icon={<ShoppingCart className="h-4 w-4" />} />
        <StatCard title="Pending Approval" value={stats.pending} icon={<ClipboardCheck className="h-4 w-4" />} />
        <StatCard title="ASMs" value={stats.asms} icon={<Users className="h-4 w-4" />} />
        <StatCard title="Inventory" value="—" icon={<Package className="h-4 w-4" />} />
      </div>

      <div className="rounded-lg border bg-card p-4">
        <div className="grid gap-4 md:grid-cols-2">
          <a href="/cf/orders" className="flex items-center gap-3 rounded-lg border p-4 hover:bg-muted transition-colors">
            <ClipboardCheck className="h-8 w-8 text-primary" />
            <div>
              <p className="font-medium">Review Orders</p>
              <p className="text-sm text-muted-foreground">Approve or reject orders from your ASMs</p>
            </div>
          </a>
          <a href="/cf/asms" className="flex items-center gap-3 rounded-lg border p-4 hover:bg-muted transition-colors">
            <Users className="h-8 w-8 text-primary" />
            <div>
              <p className="font-medium">View ASMs</p>
              <p className="text-sm text-muted-foreground">Monitor your area sales managers &amp; their metrics</p>
            </div>
          </a>
        </div>
      </div>
    </div>
  )
}
