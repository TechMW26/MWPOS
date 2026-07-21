'use client';

import { useEffect, useMemo, useState } from 'react';
import { Card, CardHeader, CardTitle, CardContent } from '@/components/ui/card';
import { DataTable } from '@/components/ui/data-table';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Modal } from '@/components/ui/modal';
import { Check, X, UserPlus, Loader2, ExternalLink, Plus, Trash2 } from 'lucide-react';
import Link from 'next/link';
import { useRealtimeList } from '@/lib/hooks/use-realtime-list';
import { INDIAN_STATES, getDistrictsForState } from '@/lib/indian-districts';
import type { District, ASMLocation } from '@/types/models';

interface LocationRow {
  key: number; // React key
  state: string;
  district: string;
  ward: string;
  districtId: string;
}

export default function AsmPage() {
  const [showAdd, setShowAdd] = useState(false);
  const [addEmail, setAddEmail] = useState('');
  const [addPhone, setAddPhone] = useState('');
  const [addName, setAddName] = useState('');
  const [locations, setLocations] = useState<LocationRow[]>([
    { key: 0, state: '', district: '', ward: '', districtId: '' },
  ]);
  const [locationCounter, setLocationCounter] = useState(1);
  const [districts, setDistricts] = useState<District[]>([]);
  const [areaCache, setAreaCache] = useState<Record<string, string[]>>({});
  const [areasLoading, setAreasLoading] = useState<Record<string, boolean>>({});
  const [adding, setAdding] = useState(false);
  const [actionMsg, setActionMsg] = useState('');
  const { data: liveManagers, loading, error, live } = useRealtimeList({
    path: 'users',
    fallbackUrl: '/api/users?role=ASM',
    orderChild: 'role',
    equalValue: 'ASM',
  });
  const managers = liveManagers;

  function getDistrictsForLocation(state: string): string[] {
    return getDistrictsForState(state);
  }

  function getDistrictOptionsForLocation(state: string, district: string): { id: string; name: string }[] {
    const configured = districts
      .filter(d => d.state === state && d.city === district)
      .map(d => ({ id: d.id, name: d.name }));
    if (configured.length > 0) return configured;
    return getDistrictsForState(state).filter(d => d === district).map(d => ({
      id: `${state}|${district}`,
      name: district,
    }));
  }

  function getWardOptionsForLocation(state: string, district: string): { id: string; name: string }[] {
    const cacheKey = `${state}||${district}`;
    const areas = areaCache[cacheKey] || [];
    return areas.map(w => ({
      id: `${state}|${district}|${w}`,
      name: w,
    }));
  }

  function updateLocation(key: number, patch: Partial<LocationRow>) {
    setLocations(prev => prev.map(l => l.key === key ? { ...l, ...patch } : l));
  }

  function addLocation() {
    setLocations(prev => [...prev, { key: locationCounter, state: '', district: '', ward: '', districtId: '' }]);
    setLocationCounter(c => c + 1);
  }

  function removeLocation(key: number) {
    setLocations(prev => prev.length > 1 ? prev.filter(l => l.key !== key) : prev);
  }

  function fetchAreasForLocation(state: string, district: string) {
    const cacheKey = `${state}||${district}`;
    if (areaCache[cacheKey] || !state || !district) return;
    setAreasLoading(prev => ({ ...prev, [cacheKey]: true }));
    const controller = new AbortController();
    fetch(`/api/geo/areas?state=${encodeURIComponent(state)}&city=${encodeURIComponent(district)}`, { signal: controller.signal })
      .then(r => r.ok ? r.json() : [])
      .then((data: string[]) => setAreaCache(prev => ({ ...prev, [cacheKey]: Array.isArray(data) ? data : [] })))
      .catch(() => {})
      .finally(() => setAreasLoading(prev => ({ ...prev, [cacheKey]: false })));
  }

  // Fetch areas when any location's state+district changes
  useEffect(() => {
    locations.forEach(loc => fetchAreasForLocation(loc.state, loc.district));
  }, [locations.map(l => `${l.state}|${l.district}`).join(',')]);

  useEffect(() => {
    fetch('/api/districts')
      .then(r => r.json())
      .then(data => setDistricts(Array.isArray(data) ? data : []))
      .catch(() => setDistricts([]));
  }, []);

  async function handleAdd(e: React.FormEvent) {
    e.preventDefault();
    if (!addPhone) { setActionMsg('Phone number required'); return; }
    const incomplete = locations.find(l => !l.state || !l.district || !l.ward);
    if (incomplete) { setActionMsg('All locations must have State, District and Ward'); return; }
    setAdding(true); setActionMsg('');
    try {
      const asmLocations: ASMLocation[] = locations.map(l => ({
        state: l.state,
        district: l.district,
        ward: l.ward,
        districtId: `${l.state}|${l.district}|${l.ward}`,
      }));
      const res = await fetch('/api/users', {
        method: 'POST', headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          email: addEmail || null,
          phone: addPhone,
          displayName: addName || addPhone,
          role: 'ASM',
          districtId: asmLocations.length > 0 ? asmLocations[0]!.districtId : '',
          locations: asmLocations,
        }),
      });
      if (!res.ok) {
        const data = await res.json();
        throw new Error(data.message || 'Failed');
      }
      setActionMsg('ASM created');
      setShowAdd(false); setAddEmail(''); setAddPhone(''); setAddName('');
      setLocations([{ key: locationCounter, state: '', district: '', ward: '', districtId: '' }]);
      setLocationCounter(c => c + 1);
      setAreaCache({});
    } catch (e: any) { setActionMsg('Error: ' + (e.message || 'Failed')); }
    finally { setAdding(false); }
  }

  async function handleApproval(uid: string, status: string) {
    setActionMsg('');
    try {
      await fetch('/api/users', {
        method: 'PATCH', headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ uid, approvalStatus: status }),
      });
      setActionMsg(status === 'APPROVED' ? 'Manager approved' : 'Manager rejected');
    } catch { setActionMsg('Failed to update'); }
  }

  const pending = managers.filter(m => m.approvalStatus === 'PENDING');
  const approved = managers.filter(m => m.approvalStatus === 'APPROVED');
  const districtById = useMemo(() => new Map(districts.map(d => [d.id, d])), [districts]);

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between gap-3">
        <p className="text-sm text-muted-foreground">{live ? 'Live updates on' : 'Auto refresh on'}</p>
        <Button className="w-full sm:w-auto" onClick={() => setShowAdd(true)}><UserPlus className="h-4 w-4 mr-2" />Add ASM</Button>
      </div>

      {actionMsg && (
        <div className="flex items-center gap-2 p-3 rounded-md bg-muted text-sm">
          <span>{actionMsg}</span><button onClick={() => setActionMsg('')} className="ml-auto"><X className="h-3 w-3" /></button>
        </div>
      )}

      <Modal open={showAdd} title="Add ASM (Area Sales Manager)" onClose={() => setShowAdd(false)}>
            <form onSubmit={handleAdd} className="space-y-5">
              <div className="grid grid-cols-1 gap-4 md:grid-cols-3">
                <div>
                  <label className="text-sm font-medium block mb-1">Display Name</label>
                  <Input placeholder="John Doe" value={addName}
                    onChange={e => setAddName(e.target.value)} />
                </div>
                <div>
                  <label className="text-sm font-medium block mb-1">Email Address (optional)</label>
                  <Input type="email" placeholder="manager@example.com" value={addEmail}
                    onChange={e => setAddEmail(e.target.value)} />
                </div>
                <div>
                  <label className="text-sm font-medium block mb-1">Phone Number</label>
                  <Input type="tel" inputMode="tel" autoComplete="tel" placeholder="+91 98765 43210" value={addPhone}
                    onChange={e => setAddPhone(e.target.value)} />
                </div>
              </div>

              <div className="border-t pt-4">
                <div className="flex items-center justify-between mb-3">
                  <p className="text-sm font-semibold">Territory Locations ({locations.length})</p>
                  <Button type="button" variant="outline" size="sm" onClick={addLocation}>
                    <Plus className="h-3.5 w-3.5 mr-1" /> Add Location
                  </Button>
                </div>
                {locations.map((loc, idx) => (
                  <div key={loc.key} className="rounded-md border bg-muted/20 p-3 mb-3">
                    <div className="flex items-center justify-between mb-2">
                      <span className="text-xs font-medium text-muted-foreground">Location {idx + 1}</span>
                      {locations.length > 1 && (
                        <Button type="button" variant="ghost" size="sm" className="h-6 w-6 p-0 text-destructive" onClick={() => removeLocation(loc.key)}>
                          <Trash2 className="h-3.5 w-3.5" />
                        </Button>
                      )}
                    </div>
                    <div className="grid grid-cols-1 gap-3 md:grid-cols-3">
                      <div>
                        <label className="text-xs font-medium block mb-1">State</label>
                        <select className="flex h-9 w-full rounded-md border border-input bg-background px-3 py-1 text-sm"
                          value={loc.state}
                          onChange={e => updateLocation(loc.key, { state: e.target.value, district: '', ward: '', districtId: '' })}
                          required>
                          <option value="">Select State *</option>
                          {INDIAN_STATES.map(s => <option key={s} value={s}>{s}</option>)}
                        </select>
                      </div>
                      <div>
                        <label className="text-xs font-medium block mb-1">District</label>
                        <select className="flex h-9 w-full rounded-md border border-input bg-background px-3 py-1 text-sm"
                          value={loc.district}
                          onChange={e => updateLocation(loc.key, { district: e.target.value, ward: '', districtId: '' })}
                          required disabled={!loc.state}>
                          <option value="">{loc.state ? 'Select District *' : 'Select state'}</option>
                          {getDistrictsForLocation(loc.state).map(d => <option key={d} value={d}>{d}</option>)}
                        </select>
                      </div>
                      <div>
                        <label className="text-xs font-medium block mb-1">Ward</label>
                        <select className="flex h-9 w-full rounded-md border border-input bg-background px-3 py-1 text-sm"
                          value={loc.ward}
                          onChange={e => updateLocation(loc.key, { ward: e.target.value, districtId: `${loc.state}|${loc.district}|${e.target.value}` })}
                          required disabled={!loc.district}>
                          <option value="">{areasLoading[`${loc.state}||${loc.district}`] ? 'Loading...' : loc.district ? 'Select Ward *' : 'Select district'}</option>
                          {getWardOptionsForLocation(loc.state, loc.district).map(w => <option key={w.id} value={w.name}>{w.name}</option>)}
                        </select>
                      </div>
                    </div>
                  </div>
                ))}
              </div>

              <p className="text-xs text-muted-foreground">New ASM will be active immediately when created by an admin.</p>
              <Button className="w-full sm:w-auto" type="submit" disabled={adding || !addPhone || locations.some(l => !l.state || !l.district || !l.ward)}>
                {adding && <Loader2 className="h-4 w-4 mr-2 animate-spin" />}
                {adding ? 'Creating...' : 'Create ASM'}
              </Button>
            </form>
      </Modal>

      {loading ? (
        <div className="flex items-center justify-center py-16">
          <Loader2 className="h-8 w-8 animate-spin text-muted-foreground" />
          <span className="ml-3 text-muted-foreground">Loading...</span>
        </div>
      ) : error ? (
        <Card className="border-destructive"><CardContent className="p-4 text-center">
          <p className="text-destructive">{error}</p>
        </CardContent></Card>
      ) : (
        <>
          {pending.length > 0 && (
            <Card className="border-warning/30">
              <CardHeader><CardTitle className="text-lg flex items-center gap-2">
                <Badge variant="warning">{pending.length}</Badge> Pending Approval
              </CardTitle></CardHeader>
              <CardContent>
                <DataTable data={pending} columns={[
                  { key: 'phone', header: 'Phone' },
                  { key: 'createdAt', header: 'Applied', render: (m) => new Date(m.createdAt).toLocaleDateString() },
                  { key: 'actions', header: 'Actions', render: (m) => (
                    <div className="grid gap-2 sm:flex">
                      <Button className="w-full sm:w-auto" size="sm" onClick={() => handleApproval(m.uid, 'APPROVED')}><Check className="h-3 w-3 mr-1" />Approve</Button>
                      <Button className="w-full sm:w-auto" size="sm" variant="destructive" onClick={() => handleApproval(m.uid, 'REJECTED')}><X className="h-3 w-3 mr-1" />Reject</Button>
                    </div>
                  )},
                ]} />
              </CardContent>
            </Card>
          )}

          <Card>
            <CardHeader><CardTitle>All ASMs ({managers.length})</CardTitle></CardHeader>
            <CardContent>
              <DataTable data={managers} columns={[
                { key: 'displayName', header: 'Name', render: (m) => (
                  <Link href={`/superadmin/store-managers/${m.uid}`} className="text-blue-600 hover:underline font-medium flex items-center gap-1">
                    {m.displayName || m.email || m.phone} <ExternalLink className="h-3 w-3" />
                  </Link>
                )},
                { key: 'phone', header: 'Phone', render: (m) => m.phone || '—' },
                { key: 'districtId', header: 'District', render: (m) => {
                  const district = districtById.get(m.districtId);
                  return district ? `${district.name} (${district.city})` : m.districtId || '—';
                }},
                { key: 'approvalStatus', header: 'Status', render: (m) => {
                  const s = m.approvalStatus;
                  return <Badge variant={s === 'APPROVED' ? 'success' : s === 'REJECTED' ? 'destructive' : 'warning'}>{s || 'N/A'}</Badge>;
                }},
                { key: 'isActive', header: 'Active', render: (m) => m.isActive ? <Badge variant="success">Yes</Badge> : <Badge variant="destructive">No</Badge> },
                { key: 'createdAt', header: 'Joined', render: (m) => new Date(m.createdAt).toLocaleDateString() },
              ]} emptyMessage="No ASMs. Click 'Add ASM' to create one." />
            </CardContent>
          </Card>
        </>
      )}
    </div>
  );
}
