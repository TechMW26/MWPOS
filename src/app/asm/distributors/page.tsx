'use client'

import { useEffect, useState } from 'react'
import { Card } from '@/components/ui/card'
import { Badge } from '@/components/ui/badge'
import type { Distributor } from '@/types/models'

export default function AsmDistributorsPage() {
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
      <p className="text-muted-foreground">Distributors in your assigned district</p>

      {loading ? (
        <p className="text-muted-foreground">Loading...</p>
      ) : distributors.length === 0 ? (
        <Card className="p-4 text-center">
          <p className="text-muted-foreground">No distributors found in your district.</p>
        </Card>
      ) : (
        <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-3">
          {distributors.map((d) => (
            <Card key={d.id} className="p-4">
              <h3 className="font-semibold">{d.name}</h3>
              <p className="text-sm text-muted-foreground">{d.city}, {d.state}</p>
              <p className="text-sm">{d.phone}</p>
              <div className="mt-2 flex gap-2">
                <Badge variant={d.approvalStatus === 'APPROVED' ? 'default' : 'secondary'}>
                  {d.approvalStatus}
                </Badge>
                {d.gstin && <Badge variant="outline">GST: {d.gstin}</Badge>}
              </div>
            </Card>
          ))}
        </div>
      )}
    </div>
  )
}
