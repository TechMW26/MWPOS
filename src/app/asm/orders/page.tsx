'use client'

import { useEffect, useState } from 'react'
import { Card } from '@/components/ui/card'
import { Badge } from '@/components/ui/badge'

const statusColors: Record<string, string> = {
  PENDING_OTP: 'bg-yellow-500',
  OTP_VERIFIED: 'bg-blue-500',
  PENDING_CF_APPROVAL: 'bg-purple-500',
  CF_APPROVED: 'bg-green-500',
  CF_REJECTED: 'bg-red-500',
  ALLOCATED: 'bg-teal-500',
  DELIVERED: 'bg-emerald-500',
  CANCELLED: 'bg-gray-500',
}

export default function AsmOrdersPage() {
  const [orders, setOrders] = useState<any[]>([])
  const [loading, setLoading] = useState(true)

  useEffect(() => {
    fetch('/api/orders')
      .then(r => r.ok ? r.json() : [])
      .then(setOrders)
      .finally(() => setLoading(false))
  }, [])

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <p className="text-muted-foreground">Orders you&apos;ve placed for distributors</p>
        <a href="/asm/pos" className="inline-flex items-center rounded-md bg-primary px-4 py-2 text-sm font-medium text-primary-foreground hover:bg-primary/90">
          + New Order
        </a>
      </div>

      {loading ? (
        <p className="text-muted-foreground">Loading orders...</p>
      ) : orders.length === 0 ? (
        <Card className="p-4 text-center">
          <p className="text-muted-foreground">No orders yet.</p>
        </Card>
      ) : (
        <div className="space-y-3">
          {orders.map((order: any) => (
            <Card key={order.id} className="p-4">
              <div className="flex items-center justify-between">
                <div>
                  <p className="font-medium">Order #{order.id?.slice(0, 8)}</p>
                  <p className="text-sm text-muted-foreground">
                    {new Date(order.createdAt).toLocaleString()} · ₹{(order.totalPaise / 100).toLocaleString('en-IN')}
                  </p>
                </div>
                <Badge className={statusColors[order.status] || 'bg-gray-500'}>
                  {order.status?.replace(/_/g, ' ')}
                </Badge>
              </div>
              {order.otpStatus === 'PENDING' && (
                <p className="text-sm text-yellow-600 mt-2">
                  ⏳ Awaiting distributor OTP verification
                </p>
              )}
            </Card>
          ))}
        </div>
      )}
    </div>
  )
}
