'use client'

import { useState, useEffect } from 'react'
import { useRouter } from 'next/navigation'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Card } from '@/components/ui/card'
import { Badge } from '@/components/ui/badge'
import { Modal } from '@/components/ui/modal'
import { Plus, MapPin, Loader2 } from 'lucide-react'
import type { District } from '@/types/models'
import { INDIAN_STATES } from '@/lib/indian-districts'

export default function DistrictsPage() {
  const router = useRouter()
  const [districts, setDistricts] = useState<District[]>([])
  const [loading, setLoading] = useState(true)
  const [creating, setCreating] = useState(false)
  const [showCreate, setShowCreate] = useState(false)
  const [name, setName] = useState('')
  const [city, setCity] = useState('')
  const [state, setState] = useState('')
  const [error, setError] = useState('')

  useEffect(() => {
    fetchDistricts()
  }, [])

  async function fetchDistricts() {
    try {
      const res = await fetch('/api/districts')
      if (res.ok) setDistricts(await res.json())
    } catch { /* ignore */ }
    setLoading(false)
  }

  async function handleCreate(e: React.FormEvent) {
    e.preventDefault()
    setError('')
    setCreating(true)

    try {
      const res = await fetch('/api/districts', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ name, city, state }),
      })

      if (!res.ok) {
        const data = await res.json()
        setError(data.message || 'Failed to create district')
        return
      }

      setName('')
      setCity('')
      setState('')
      setShowCreate(false)
      fetchDistricts()
    } catch {
      setError('Network error')
    } finally {
      setCreating(false)
    }
  }

  return (
    <div className="space-y-8">
      <p className="text-muted-foreground">Manage geographic districts for ASM assignment</p>

      <Button className="w-full sm:w-auto" onClick={() => setShowCreate(true)}>
        <Plus className="h-4 w-4 mr-2" />Add District
      </Button>

      <Modal open={showCreate} title="Create New District" onClose={() => setShowCreate(false)}>
        <form onSubmit={handleCreate} className="grid grid-cols-1 gap-4 md:grid-cols-3">
          <div className="flex-1 min-w-[200px]">
            <label className="text-sm font-medium">District Name</label>
            <Input
              value={name}
              onChange={(e) => setName(e.target.value)}
              placeholder="e.g. North Mumbai"
              required
              minLength={2}
            />
          </div>
          <div className="flex-1 min-w-[200px]">
            <label className="text-sm font-medium">State</label>
            <select
              className="flex h-10 w-full rounded-md border border-input bg-background px-3 py-2 text-sm"
              value={state}
              onChange={(e) => setState(e.target.value)}
              required
            >
              <option value="">Select State</option>
              {INDIAN_STATES.map((s) => <option key={s} value={s}>{s}</option>)}
            </select>
          </div>
          <div className="flex-1 min-w-[200px]">
            <label className="text-sm font-medium">City</label>
            <Input
              value={city}
              onChange={(e) => setCity(e.target.value)}
              placeholder="e.g. Indore"
              required
            />
          </div>
          <Button type="submit" disabled={creating}>
            {creating ? <Loader2 className="h-4 w-4 animate-spin mr-2" /> : <Plus className="h-4 w-4 mr-2" />}
            Create District
          </Button>
        </form>
        {error && <p className="text-red-500 text-sm mt-2">{error}</p>}
      </Modal>

      {/* District List */}
      <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-3">
        {loading ? (
          <p className="text-muted-foreground col-span-full">Loading districts...</p>
        ) : districts.length === 0 ? (
          <p className="text-muted-foreground col-span-full">No districts created yet.</p>
        ) : (
          districts.map((d) => (
            <Card key={d.id} className="p-4 hover:shadow-md transition-shadow">
              <div className="flex items-start justify-between">
                <div className="flex items-center gap-3">
                  <MapPin className="h-5 w-5 text-primary" />
                  <div>
                    <h3 className="font-semibold">{d.name}</h3>
                    <p className="text-sm text-muted-foreground">{d.city ? `${d.city}, ${d.state}` : d.state}</p>
                  </div>
                </div>
                <Badge variant={d.isActive ? 'default' : 'secondary'}>
                  {d.isActive ? 'Active' : 'Inactive'}
                </Badge>
              </div>
              <p className="text-xs text-muted-foreground mt-3">
                Created {new Date(d.createdAt).toLocaleDateString()}
              </p>
            </Card>
          ))
        )}
      </div>
    </div>
  )
}
