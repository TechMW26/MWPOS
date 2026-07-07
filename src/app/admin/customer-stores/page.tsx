'use client';
import { useState, useEffect } from 'react';
import { Card, CardHeader, CardTitle, CardContent } from '@/components/ui/card';
import { DataTable } from '@/components/ui/data-table';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Plus, Check, X } from 'lucide-react';

export default function CustomerStoresPage() {
  const [stores, setStores] = useState<any[]>([]);
  const [customers, setCustomers] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const [showForm, setShowForm] = useState(false);
  const [form, setForm] = useState({ name:'', type:'CUSTOMER', address:'', city:'', state:'', pincode:'', phone:'', email:'', logoUrl:'', ownerUid:'', ownerName:'', ownerEmail:'', ownerPhone:'' });

  async function load() {
    try {
      const [storeRes, customerRes] = await Promise.all([fetch('/api/stores?type=CUSTOMER'), fetch('/api/users?role=CUSTOMER')]);
      const data = await storeRes.json(); const users = await customerRes.json();
      setStores(Array.isArray(data) ? data : []); setCustomers(Array.isArray(users) ? users : []);
    } catch(e){} finally { setLoading(false); }
  }
  useEffect(() => { load(); }, []);

  async function handleCreate(e: React.FormEvent) {
    e.preventDefault();
    await fetch('/api/stores', { method:'POST', headers:{'Content-Type':'application/json'}, body:JSON.stringify(form) });
    setShowForm(false); load();
  }

  async function handleApproval(storeId: string, approvalStatus: 'APPROVED' | 'REJECTED') {
    await fetch('/api/stores', { method:'PATCH', headers:{'Content-Type':'application/json'}, body:JSON.stringify({ storeId, approvalStatus }) });
    load();
  }

  function handleLogo(file: File | null) {
    if (!file) return;
    const reader = new FileReader();
    reader.onload = () => setForm({ ...form, logoUrl: String(reader.result) });
    reader.readAsDataURL(file);
  }

  if (loading) return <div className="p-6 text-muted-foreground">Loading...</div>;
  return (
    <div className="space-y-6">
      <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
        <Button className="w-full sm:w-auto" onClick={() => setShowForm(!showForm)}><Plus className="h-4 w-4 mr-2"/>{showForm ? 'Cancel' : 'Add Store'}</Button>
      </div>
      {showForm && (
        <Card><CardHeader><CardTitle>New Customer Store</CardTitle></CardHeader><CardContent>
          <form onSubmit={handleCreate} className="grid grid-cols-1 md:grid-cols-2 gap-4">
            <Input placeholder="Store Name" value={form.name} onChange={e => setForm({...form, name:e.target.value})} required />
            <Input placeholder="Address" value={form.address} onChange={e => setForm({...form, address:e.target.value})} required />
            <Input placeholder="City" value={form.city} onChange={e => setForm({...form, city:e.target.value})} required />
            <Input placeholder="State" value={form.state} onChange={e => setForm({...form, state:e.target.value})} required />
            <Input placeholder="Pincode" value={form.pincode} onChange={e => setForm({...form, pincode:e.target.value})} required />
            <Input placeholder="Phone" value={form.phone} onChange={e => setForm({...form, phone:e.target.value})} required />
            <Input placeholder="Store Email (optional)" value={form.email} onChange={e => setForm({...form, email:e.target.value})} />
            <div>
              <label className="text-sm font-medium block mb-1">Store Logo</label>
              <Input type="file" accept="image/*" onChange={e => handleLogo(e.target.files?.[0] ?? null)} />
            </div>
            <div className="md:col-span-2 space-y-3 border-t pt-3">
              <p className="text-sm font-medium">Owner mapping for OTP login</p>
              <select className="flex h-10 w-full rounded-md border border-input bg-background px-3 py-2 text-sm" value={form.ownerUid} onChange={e => setForm({...form, ownerUid:e.target.value})}>
                <option value="">Create or use owner details below</option>
                {customers.map((u:any) => <option key={u.uid} value={u.uid}>{u.displayName || u.email || u.phone}</option>)}
              </select>
              {!form.ownerUid && (
                <div className="grid grid-cols-1 gap-3 md:grid-cols-3">
                  <Input placeholder="Owner name" value={form.ownerName} onChange={e => setForm({...form, ownerName:e.target.value})} />
                  <Input placeholder="Owner email for OTP" value={form.ownerEmail} onChange={e => setForm({...form, ownerEmail:e.target.value})} />
                  <Input placeholder="Owner phone for OTP" value={form.ownerPhone} onChange={e => setForm({...form, ownerPhone:e.target.value})} />
                </div>
              )}
            </div>
            <div className="md:col-span-2"><Button className="w-full sm:w-auto" type="submit">Create Store</Button></div>
          </form>
        </CardContent></Card>
      )}
      <Card><CardHeader><CardTitle>All Customer Stores ({stores.length})</CardTitle></CardHeader><CardContent>
        <DataTable data={stores} columns={[
          { key: 'name', header: 'Name' }, { key: 'city', header: 'City' }, { key: 'phone', header: 'Phone' },
          { key: 'ownerUid', header: 'Owner', render: (s) => {
            const owner = customers.find((u: any) => u.uid === s.ownerUid);
            return owner ? (owner.displayName || owner.email || owner.phone) : <span className="text-xs text-muted-foreground">—</span>;
          }},
          { key: 'approvalStatus', header: 'Status', render: (s) => <Badge variant={s.approvalStatus === 'APPROVED' ? 'success' : s.approvalStatus === 'REJECTED' ? 'destructive' : 'warning'}>{s.approvalStatus}</Badge> },
          { key: 'actions', header: 'Actions', render: (s) => s.approvalStatus === 'PENDING' ? (
            <div className="flex gap-1">
              <Button size="sm" variant="outline" className="text-green-600 h-8 px-2" onClick={() => handleApproval(s.id, 'APPROVED')}><Check className="h-3 w-3" /></Button>
              <Button size="sm" variant="outline" className="text-red-600 h-8 px-2" onClick={() => handleApproval(s.id, 'REJECTED')}><X className="h-3 w-3" /></Button>
            </div>
          ) : null },
        ]} />
      </CardContent></Card>
    </div>
  );
}
