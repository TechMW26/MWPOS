'use client'

import { useEffect, useState } from 'react'
import { Card } from '@/components/ui/card'
import { Badge } from '@/components/ui/badge'

const statusColors: Record<string, string> = {
  PENDING_CF_APPROVAL: 'bg-purple-500',
  CF_APPROVED: 'bg-green-500',
  CF_REJECTED: 'bg-red-500',
  OTP_VERIFIED: 'bg-blue-500',
}

export default function CfOrdersPage() {
  const [orders, setOrders] = useState<any[]>([])
  const [loading, setLoading] = useState(true)

  const fetchOrders = () => {
    fetch('/api/orders')
      .then(r => r.ok ? r.json() : [])
      .then(setOrders)
      .finally(() => setLoading(false))
  }

  useEffect(() => { fetchOrders() }, [])

  async function handleApproval(orderId: string, action: 'APPROVE' | 'REJECT') {
    await fetch('/api/orders/cf-approve', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ orderId, action }),
    })
    fetchOrders()
  }

  return (
    <div className="space-y-6">
      <p className="text-muted-foreground">Approve or reject orders from your ASMs</p>

      {loading ? (
        <p className="text-muted-foreground">Loading...</p>
      ) : orders.length === 0 ? (
        <Card className="p-4 text-center"><p className="text-muted-foreground">No orders.</p></Card>
      ) : (
        <div className="space-y-3">
          {orders.map((order: any) => (
            <Card key={order.id} className="p-4">
              <div className="flex items-center justify-between flex-wrap gap-3">
                <div>
                  <p className="font-medium">Order #{order.id?.slice(0, 8)}</p>
                  <p className="text-sm text-muted-foreground">
                    ₹{(order.totalPaise / 100).toLocaleString('en-IN')} · {new Date(order.createdAt).toLocaleDateString()}
                  </p>
                  {order.otpStatus === 'VERIFIED' && (
                    <p className="text-xs text-green-600">✓ OTP Verified</p>
                  )}
                </div>
                <Badge className={statusColors[order.status] || 'bg-gray-500'}>
                  {order.status?.replace(/_/g, ' ')}
                </Badge>
                {order.status === 'PENDING_CF_APPROVAL' && (
                  <div className="flex gap-2">
                    <button
                      onClick={() => handleApproval(order.id, 'APPROVE')}
                      className="rounded-md bg-green-600 px-3 py-1 text-sm text-white hover:bg-green-700"
                    >
                      Approve
                    </button>
                    <button
                      onClick={() => handleApproval(order.id, 'REJECT')}
                      className="rounded-md bg-red-600 px-3 py-1 text-sm text-white hover:bg-red-700"
                    >
                      Reject
                    </button>
                  </div>
                )}
              </div>
            </Card>
          ))}
        </div>
      )}
    </div>
  )
}
