'use client'

import { StatCard } from '@/components/ui/stat-card'
import { ShoppingCart, Users, Package, TrendingUp } from 'lucide-react'
import { useEffect, useState } from 'react'

export default function AsmDashboard() {
  const [stats, setStats] = useState({ orders: 0, distributors: 0, products: 0 })

  useEffect(() => {
    async function load() {
      try {
        const [ordersRes, distRes] = await Promise.all([
          fetch('/api/orders'),
          fetch('/api/distributors'),
        ])
        if (ordersRes.ok) {
          const orders = await ordersRes.json()
          setStats(s => ({ ...s, orders: orders.length }))
        }
        if (distRes.ok) {
          const distributors = await distRes.json()
          setStats(s => ({ ...s, distributors: distributors.length }))
        }
      } catch { /* ignore */ }
    }
    load()
  }, [])

  return (
    <div className="space-y-6">
      <p className="text-muted-foreground">Area Sales Manager — Manage your district &amp; distributors</p>

      <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-4">
        <StatCard title="Orders" value={stats.orders} icon={<ShoppingCart className="h-4 w-4" />} />
        <StatCard title="Distributors" value={stats.distributors} icon={<Users className="h-4 w-4" />} />
        <StatCard title="Products" value={stats.products} icon={<Package className="h-4 w-4" />} />
        <StatCard title="Revenue (₹)" value="—" icon={<TrendingUp className="h-4 w-4" />} />
      </div>

      <div className="rounded-lg border bg-card p-4">
        <div className="grid gap-4 md:grid-cols-2">
          <a href="/asm/orders" className="flex items-center gap-3 rounded-lg border p-4 hover:bg-muted transition-colors">
            <ShoppingCart className="h-8 w-8 text-primary" />
            <div>
              <p className="font-medium">Place New Order</p>
              <p className="text-sm text-muted-foreground">Create order for a distributor in your district</p>
            </div>
          </a>
          <a href="/asm/distributors" className="flex items-center gap-3 rounded-lg border p-4 hover:bg-muted transition-colors">
            <Users className="h-8 w-8 text-primary" />
            <div>
              <p className="font-medium">View Distributors</p>
              <p className="text-sm text-muted-foreground">Manage distributors in your assigned district</p>
            </div>
          </a>
        </div>
      </div>
    </div>
  )
}
