'use client';

import { useEffect, useMemo, useState } from 'react';
import { Card, CardHeader, CardTitle, CardContent } from '@/components/ui/card';
import { DataTable } from '@/components/ui/data-table';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Modal } from '@/components/ui/modal';
import { Check, X, UserPlus, Loader2, ExternalLink } from 'lucide-react';
import { useRealtimeList } from '@/lib/hooks/use-realtime-list';
import Link from 'next/link';
import { INDIAN_STATES, getAreasForCity, getDistrictsForState } from '@/lib/indian-districts';
import type { District } from '@/types/models';

export default function AsmPage() {
  const [showAdd, setShowAdd] = useState(false);
  const [addEmail, setAddEmail] = useState('');
  const [addPhone, setAddPhone] = useState('');
  const [addName, setAddName] = useState('');
  const [addState, setAddState] = useState('');
  const [addCity, setAddCity] = useState('');
  const [addDistrictId, setAddDistrictId] = useState('');
  const [districts, setDistricts] = useState<District[]>([]);
  const [cityAreas, setCityAreas] = useState<string[]>([]);
  const [areasLoading, setAreasLoading] = useState(false);
  const [adding, setAdding] = useState(false);
  const [actionMsg, setActionMsg] = useState('');
  const { data: liveManagers, loading, error, live } = useRealtimeList({
    path: 'users',
    fallbackUrl: '/api/users?role=ASM',
    orderChild: 'role',
    equalValue: 'ASM',
  });
  const managers = liveManagers;
  const citiesForState = useMemo(() => {
    const cities = districts
      .filter(d => d.state === addState && d.city)
      .map(d => d.city);
    return Array.from(new Set([...cities, ...getDistrictsForState(addState)])).sort();
  }, [addState, districts]);
  const districtsForCity = useMemo(() => {
    const configured = districts
      .filter(d => d.state === addState && d.city === addCity)
      .map(d => ({ id: d.id, name: d.name, city: d.city, state: d.state }));
    const areas = Array.from(new Set([...getAreasForCity(addState, addCity), ...cityAreas]));
    const areaOptions = areas.map(area => ({
      id: `${addState}|${addCity}|${area}`,
      name: area,
      city: addCity,
      state: addState,
    }));
    const fallback = getDistrictsForState(addState).includes(addCity)
      ? [{ id: `${addState}|${addCity}`, name: addCity, city: addCity, state: addState }]
      : [];
    if (configured.length > 0) return configured;
    if (areaOptions.length > 0) return areaOptions;
    return fallback;
  }, [addCity, addState, cityAreas, districts]);
  const districtById = useMemo(() => new Map(districts.map(d => [d.id, d])), [districts]);

  useEffect(() => {
    fetch('/api/districts')
      .then(r => r.json())
      .then(data => setDistricts(Array.isArray(data) ? data : []))
      .catch(() => setDistricts([]));
  }, []);

  useEffect(() => {
    if (!addState || !addCity) {
      setCityAreas([]);
      return;
    }
    const controller = new AbortController();
    setAreasLoading(true);
    fetch(`/api/geo/areas?state=${encodeURIComponent(addState)}&city=${encodeURIComponent(addCity)}`, { signal: controller.signal })
      .then(r => r.ok ? r.json() : [])
      .then(data => setCityAreas(Array.isArray(data) ? data : []))
      .catch(() => setCityAreas([]))
      .finally(() => setAreasLoading(false));
    return () => controller.abort();
  }, [addCity, addState]);

  async function handleAdd(e: React.FormEvent) {
    e.preventDefault();
    if (!addEmail && !addPhone) { setActionMsg('Email or phone required'); return; }
    if (!addState || !addCity || !addDistrictId) { setActionMsg('State, city and district required'); return; }
    setAdding(true); setActionMsg('');
    try {
      const res = await fetch('/api/users', {
        method: 'POST', headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          email: addEmail || null,
          phone: addPhone || null,
          displayName: addName || addEmail || addPhone,
          role: 'ASM',
          districtId: addDistrictId,
        }),
      });
      if (!res.ok) {
        const data = await res.json();
        throw new Error(data.message || 'Failed');
      }
      setActionMsg('ASM created');
      setShowAdd(false); setAddEmail(''); setAddPhone(''); setAddName(''); setAddState(''); setAddCity(''); setAddDistrictId('');
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
                  <label className="text-sm font-medium block mb-1">Email Address</label>
                  <Input type="email" placeholder="manager@example.com" value={addEmail}
                    onChange={e => setAddEmail(e.target.value)} />
                </div>
                <div>
                  <label className="text-sm font-medium block mb-1">Phone (optional)</label>
                  <Input type="tel" placeholder="+91..." value={addPhone}
                    onChange={e => setAddPhone(e.target.value)} />
                </div>
              </div>
              <div className="grid grid-cols-1 gap-4 md:grid-cols-3">
                <div>
                  <label className="text-sm font-medium block mb-1">State</label>
                  <select className="flex h-10 w-full rounded-md border border-input bg-background px-3 py-2 text-sm" value={addState}
                    onChange={e => { setAddState(e.target.value); setAddCity(''); setAddDistrictId(''); }} required>
                    <option value="">Select State *</option>
                    {INDIAN_STATES.map(s => <option key={s} value={s}>{s}</option>)}
                  </select>
                </div>
                <div>
                  <label className="text-sm font-medium block mb-1">City</label>
                  <select className="flex h-10 w-full rounded-md border border-input bg-background px-3 py-2 text-sm" value={addCity}
                    onChange={e => { setAddCity(e.target.value); setAddDistrictId(''); }} required disabled={!addState}>
                    <option value="">{addState ? 'Select City *' : 'Select state first'}</option>
                    {citiesForState.map(c => <option key={c} value={c}>{c}</option>)}
                  </select>
                </div>
                <div>
                  <label className="text-sm font-medium block mb-1">District</label>
                  <select className="flex h-10 w-full rounded-md border border-input bg-background px-3 py-2 text-sm" value={addDistrictId}
                    onChange={e => setAddDistrictId(e.target.value)} required disabled={!addCity}>
                    <option value="">{areasLoading ? 'Loading areas...' : 'Select District *'}</option>
                    {districtsForCity.map(d => <option key={d.id} value={d.id}>{d.name}</option>)}
                  </select>
                </div>
              </div>
              <p className="text-xs text-muted-foreground">New ASM will be active immediately when created by an admin.</p>
              <Button className="w-full sm:w-auto" type="submit" disabled={adding || (!addEmail && !addPhone) || !addDistrictId}>
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
                  { key: 'email', header: 'Email' },
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
                { key: 'email', header: 'Email/Phone', render: (m) => m.email || m.phone || '—' },
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
