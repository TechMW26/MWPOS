'use client';

import { useState, useEffect, useMemo } from 'react';
import { Card, CardHeader, CardTitle, CardContent } from '@/components/ui/card';
import { DataTable } from '@/components/ui/data-table';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Plus, Check, X, Trash2, Edit3 } from 'lucide-react';
import { INDIAN_STATES, getDistrictsForState } from '@/lib/indian-districts';

export default function DistributorsPage() {
  const [distributors, setDistributors] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const [creating, setCreating] = useState(false);
  const [createError, setCreateError] = useState('');
  const [showForm, setShowForm] = useState(false);
  const [editing, setEditing] = useState<any>(null);
  const [form, setForm] = useState({ name:'', state:'', district:'', city:'', ward:'', address:'', pincode:'', phone:'', email:'', gstin:'', ownerName:'', ownerEmail:'', ownerPhone:'' });
  const [wardOptions, setWardOptions] = useState<string[]>([]);
  const [wardsLoading, setWardsLoading] = useState(false);

  const districtsForState = useMemo(() => getDistrictsForState(form.state), [form.state]);

  useEffect(() => {
    if (!form.state || !form.city) { setWardOptions([]); return; }
    const controller = new AbortController();
    setWardsLoading(true);
    fetch(`/api/geo/areas?state=${encodeURIComponent(form.state)}&city=${encodeURIComponent(form.city)}`, { signal: controller.signal })
      .then(r => r.ok ? r.json() : [])
      .then(data => setWardOptions(Array.isArray(data) ? data : []))
      .catch(() => setWardOptions([]))
      .finally(() => setWardsLoading(false));
    return () => controller.abort();
  }, [form.state, form.city]);

  async function load() {
    try {
      const res = await fetch('/api/distributors');
      const data = await res.json();
      setDistributors(Array.isArray(data) ? data : []);
    } catch(e){} finally { setLoading(false); }
  }
  useEffect(() => { load(); }, []);

  async function handleCreate(e: React.FormEvent) {
    e.preventDefault();
    setCreateError('');
    if (!form.state || !form.district || !form.city || !form.ward) { setCreateError('Please fill all location fields: State, District, City and Ward'); return; }
    setCreating(true);
    try {
      const districtId = `${form.state}|${form.district}|${form.city}|${form.ward}`;
      const res = await fetch('/api/stores', { method:'POST', headers:{'Content-Type':'application/json'}, body:JSON.stringify({ ...form, districtId, type: 'DISTRIBUTOR' }) });
      const data = await res.json().catch(() => null);
      if (!res.ok) {
        const fieldErrors = data?.errors?.fieldErrors
          ? Object.entries(data.errors.fieldErrors).flatMap(([field, errors]) => (errors as string[]).map(error => `${field}: ${error}`)).join(', ')
          : '';
        throw new Error(fieldErrors || data?.message || 'Failed to create distributor');
      }
      setShowForm(false);
      setForm({ name:'', state:'', district:'', city:'', ward:'', address:'', pincode:'', phone:'', email:'', gstin:'', ownerName:'', ownerEmail:'', ownerPhone:'' });
      await load();
    } catch (error) {
      setCreateError(error instanceof Error ? error.message : 'Failed to create distributor');
    } finally {
      setCreating(false);
    }
  }

  async function handleApproval(id: string, approvalStatus: 'APPROVED' | 'REJECTED') {
    await fetch('/api/stores', { method:'PATCH', headers:{'Content-Type':'application/json'}, body:JSON.stringify({ storeId: id, approvalStatus }) });
    load();
  }

  async function handleDelete(id: string) {
    if (!confirm('Delete this distributor?')) return;
    await fetch('/api/stores?storeId=' + id, { method:'DELETE' });
    load();
  }

  async function handleEditSave(e: React.FormEvent) {
    e.preventDefault();
    if (!editing) return;
    await fetch('/api/stores', {
      method: 'PATCH', headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        storeId: editing.id, name: editing.name, address: editing.address,
        city: editing.city, state: editing.state, pincode: editing.pincode,
        phone: editing.phone, email: editing.email, gstin: editing.gstin,
        isActive: editing.isActive,
      }),
    });
    setEditing(null); load();
  }

  if (loading) return <div className="p-6 text-muted-foreground">Loading...</div>;

  return (
    <div className="space-y-6">
      <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
        <Button className="w-full sm:w-auto" onClick={() => { setCreateError(''); setShowForm(true); }}>
          <Plus className="h-4 w-4 mr-2"/>Add Distributor
        </Button>
      </div>

      {showForm && (
        <Card>
          <CardHeader className="flex flex-row items-center justify-between">
            <CardTitle>New Distributor</CardTitle>
            <Button variant="ghost" size="sm" onClick={() => { setCreateError(''); setShowForm(false); }}><X className="h-4 w-4" /></Button>
          </CardHeader>
          <CardContent>
            <form onSubmit={handleCreate} className="space-y-5">
              {createError && <div className="rounded-md border border-destructive/20 bg-destructive/10 p-3 text-sm text-destructive">{createError}</div>}
              <div className="grid grid-cols-1 gap-4 md:grid-cols-2">
                <Input placeholder="Distributor Name *" value={form.name} onChange={e => setForm({...form, name:e.target.value})} required />
                <Input placeholder="Phone *" value={form.phone} onChange={e => setForm({...form, phone:e.target.value})} required />
                <Input placeholder="Email (optional)" value={form.email} onChange={e => setForm({...form, email:e.target.value})} />
                <Input placeholder="GSTIN (optional)" value={form.gstin} onChange={e => setForm({...form, gstin:e.target.value})} />
              </div>
              <div className="grid grid-cols-1 gap-4 md:grid-cols-2">
                <div>
                  <label className="text-sm font-medium block mb-1">State</label>
                  <select className="flex h-10 w-full rounded-md border border-input bg-background px-3 py-2 text-sm" value={form.state} onChange={e => setForm({...form, state:e.target.value, district:'', city:'', ward:''})} required>
                    <option value="">Select State *</option>
                    {INDIAN_STATES.map(s => <option key={s} value={s}>{s}</option>)}
                  </select>
                </div>
                <div>
                  <label className="text-sm font-medium block mb-1">District</label>
                  <select className="flex h-10 w-full rounded-md border border-input bg-background px-3 py-2 text-sm" value={form.district} onChange={e => setForm({...form, district:e.target.value, city:'', ward:''})} required disabled={!form.state}>
                    <option value="">{form.state ? 'Select District *' : 'Select state first'}</option>
                    {districtsForState.map(d => <option key={d} value={d}>{d}</option>)}
                  </select>
                </div>
                <div>
                  <label className="text-sm font-medium block mb-1">City</label>
                  <select className="flex h-10 w-full rounded-md border border-input bg-background px-3 py-2 text-sm" value={form.city} onChange={e => setForm({...form, city:e.target.value, ward:''})} required disabled={!form.district}>
                    <option value="">{form.district ? 'Select City *' : 'Select district first'}</option>
                    {districtsForState.map(d => <option key={d} value={d}>{d}</option>)}
                  </select>
                </div>
                <div>
                  <label className="text-sm font-medium block mb-1">Ward / Area</label>
                  <select className="flex h-10 w-full rounded-md border border-input bg-background px-3 py-2 text-sm" value={form.ward} onChange={e => setForm({...form, ward:e.target.value})} required disabled={!form.city}>
                    <option value="">{wardsLoading ? 'Loading...' : form.city ? 'Select Ward *' : 'Select city first'}</option>
                    {wardOptions.map(w => <option key={w} value={w}>{w}</option>)}
                  </select>
                </div>
              </div>
              <div className="grid grid-cols-1 gap-4 md:grid-cols-[2fr_1fr]">
                <Input placeholder="Address *" value={form.address} onChange={e => setForm({...form, address:e.target.value})} required />
                <Input placeholder="Pincode *" value={form.pincode} onChange={e => setForm({...form, pincode:e.target.value})} required />
              </div>
              <div className="md:col-span-2 border-t pt-3">
                <p className="text-sm font-medium mb-2">Owner Details (for OTP login)</p>
                <div className="grid grid-cols-1 gap-3 md:grid-cols-3">
                  <Input placeholder="Owner name" value={form.ownerName} onChange={e => setForm({...form, ownerName:e.target.value})} />
                  <Input placeholder="Owner email for OTP" value={form.ownerEmail} onChange={e => setForm({...form, ownerEmail:e.target.value})} />
                  <Input placeholder="Owner phone" value={form.ownerPhone} onChange={e => setForm({...form, ownerPhone:e.target.value})} />
                </div>
              </div>
              <div><Button className="w-full sm:w-auto" type="submit" disabled={creating}>{creating ? 'Creating...' : 'Create Distributor'}</Button></div>
            </form>
          </CardContent>
        </Card>
      )}

      <Card>
        <CardHeader><CardTitle>All Distributors ({distributors.length})</CardTitle></CardHeader>
        <CardContent>
          <DataTable
            data={distributors}
            columns={[
              { key: 'name', header: 'Name' },
              { key: 'districtId', header: 'District', render: (d) => {
                const parts = (d.districtId || '').split('|');
                return <span className="text-sm">{parts[1] || parts[0] || d.districtId}</span>;
              }},
              { key: 'city', header: 'City' },
              { key: 'phone', header: 'Phone' },
              { key: 'approvalStatus', header: 'Status', render: (d) => (
                <Badge variant={d.approvalStatus === 'APPROVED' ? 'success' : d.approvalStatus === 'REJECTED' ? 'destructive' : 'warning'}>
                  {d.approvalStatus}
                </Badge>
              )},
              { key: 'actions', header: 'Actions', render: (d) => (
                <div className="flex gap-1">
                  {d.approvalStatus === 'PENDING' && (
                    <>
                      <Button size="sm" variant="outline" className="text-green-600 h-8 px-2" onClick={() => handleApproval(d.id, 'APPROVED')}><Check className="h-3 w-3" /></Button>
                      <Button size="sm" variant="outline" className="text-red-600 h-8 px-2" onClick={() => handleApproval(d.id, 'REJECTED')}><X className="h-3 w-3" /></Button>
                    </>
                  )}
                  <Button size="sm" variant="outline" className="h-8 px-2" onClick={() => setEditing(d)}><Edit3 className="h-3 w-3" /></Button>
                  <Button size="sm" variant="outline" className="text-destructive h-8 px-2" onClick={() => handleDelete(d.id)}><Trash2 className="h-3 w-3" /></Button>
                </div>
              )},
            ]}
          />
        </CardContent>
      </Card>

      {editing && (
        <Card>
          <CardHeader className="flex flex-row items-center justify-between">
            <CardTitle>Edit: {editing.name}</CardTitle>
            <Button variant="ghost" size="sm" onClick={() => setEditing(null)}><X className="h-4 w-4" /></Button>
          </CardHeader>
          <CardContent>
            <form onSubmit={handleEditSave} className="grid grid-cols-1 md:grid-cols-2 gap-4">
              <div>
                <label className="text-sm font-medium block mb-1">Name</label>
                <Input value={editing.name || ''} onChange={e => setEditing({ ...editing, name: e.target.value })} required />
              </div>
              <div>
                <label className="text-sm font-medium block mb-1">Phone</label>
                <Input value={editing.phone || ''} onChange={e => setEditing({ ...editing, phone: e.target.value })} />
              </div>
              <div>
                <label className="text-sm font-medium block mb-1">Email</label>
                <Input value={editing.email || ''} onChange={e => setEditing({ ...editing, email: e.target.value })} />
              </div>
              <div>
                <label className="text-sm font-medium block mb-1">GSTIN</label>
                <Input value={editing.gstin || ''} onChange={e => setEditing({ ...editing, gstin: e.target.value })} />
              </div>
              <div>
                <label className="text-sm font-medium block mb-1">City</label>
                <Input value={editing.city || ''} onChange={e => setEditing({ ...editing, city: e.target.value })} />
              </div>
              <div>
                <label className="text-sm font-medium block mb-1">State</label>
                <Input value={editing.state || ''} onChange={e => setEditing({ ...editing, state: e.target.value })} />
              </div>
              <div>
                <label className="text-sm font-medium block mb-1">Pincode</label>
                <Input value={editing.pincode || ''} onChange={e => setEditing({ ...editing, pincode: e.target.value })} />
              </div>
              <div>
                <label className="text-sm font-medium block mb-1">Address</label>
                <Input value={editing.address || ''} onChange={e => setEditing({ ...editing, address: e.target.value })} />
              </div>
              <div className="flex items-center gap-2">
                <label className="text-sm font-medium">Active</label>
                <input type="checkbox" checked={editing.isActive !== false} onChange={e => setEditing({ ...editing, isActive: e.target.checked })} className="h-4 w-4" />
              </div>
              <div className="md:col-span-2"><Button type="submit">Save Changes</Button></div>
            </form>
          </CardContent>
        </Card>
      )}
    </div>
  );
}
