'use client'

import { useEffect, useState } from 'react'
import { Card } from '@/components/ui/card'
import { Badge } from '@/components/ui/badge'
import type { Distributor } from '@/types/models'

export default function AdminDistributorsPage() {
  const [distributors, setDistributors] = useState<Distributor[]>([])
  const [loading, setLoading] = useState(true)

  useEffect(() => {
    fetch('/api/distributors')
      .then(r => r.ok ? r.json() : [])
      .then(setDistributors)
      .finally(() => setLoading(false))
  }, [])

  return (
    <div className="space-y-6">
      <p className="text-muted-foreground">All registered distributors across districts</p>

      {loading ? (
        <p className="text-muted-foreground">Loading...</p>
      ) : distributors.length === 0 ? (
        <Card className="p-4 text-center">
          <p className="text-muted-foreground">No distributors found.</p>
        </Card>
      ) : (
        <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-3">
          {distributors.map((d) => (
            <Card key={d.id} className="p-4">
              <div className="flex items-start justify-between">
                <div>
                  <h3 className="font-semibold">{d.name}</h3>
                  <p className="text-sm text-muted-foreground">{d.city}, {d.state}</p>
                  <p className="text-sm">{d.phone}</p>
                  {d.email && <p className="text-sm text-muted-foreground">{d.email}</p>}
                </div>
                <Badge variant={d.approvalStatus === 'APPROVED' ? 'default' : 'secondary'}>
                  {d.approvalStatus}
                </Badge>
              </div>
            </Card>
          ))}
        </div>
      )}
    </div>
  )
}
