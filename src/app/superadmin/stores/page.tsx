'use client';

import { useState, useEffect } from 'react';
import { Card, CardHeader, CardTitle, CardContent } from '@/components/ui/card';
import { DataTable } from '@/components/ui/data-table';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Plus, Check, X, Trash2, Edit3 } from 'lucide-react';

export default function StoresPage() {
  const [stores, setStores] = useState<any[]>([]);
  const [customers, setCustomers] = useState<any[]>([]);
  const [managers, setManagers] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const [showForm, setShowForm] = useState(false);
  const [editingStore, setEditingStore] = useState<any>(null);
  const [form, setForm] = useState({ name:'', type:'CUSTOMER', address:'', city:'', state:'', pincode:'', phone:'', email:'', logoUrl:'', ownerUid:'', ownerName:'', ownerEmail:'', ownerPhone:'', managerUid:'' });

  async function load() {
    try {
      const [storeRes, customerRes, managerRes] = await Promise.all([
        fetch('/api/stores'),
        fetch('/api/users?role=CUSTOMER'),
        fetch('/api/users?role=STORE_MANAGER&approvalStatus=APPROVED'),
      ]);
      const data = await storeRes.json(); const users = await customerRes.json(); const mgrs = await managerRes.json();
      setStores(Array.isArray(data) ? data : []);
      setCustomers(Array.isArray(users) ? users : []);
      setManagers(Array.isArray(mgrs) ? mgrs : []);
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

  async function handleDelete(storeId: string) {
    if (!confirm('Delete this store?')) return;
    await fetch('/api/stores?storeId=' + storeId, { method:'DELETE' });
    load();
  }

  function openEdit(store: any) {
    setEditingStore(store);
  }

  async function handleEditSave(e: React.FormEvent) {
    e.preventDefault();
    if (!editingStore) return;
    await fetch('/api/stores', {
      method: 'PATCH', headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        storeId: editingStore.id,
        name: editingStore.name,
        address: editingStore.address,
        city: editingStore.city,
        state: editingStore.state,
        pincode: editingStore.pincode,
        phone: editingStore.phone,
        email: editingStore.email,
        ownerUid: editingStore.ownerUid || null,
        managerUid: editingStore.managerUid || null,
        isActive: editingStore.isActive,
      }),
    });
    setEditingStore(null);
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
        <Card>
          <CardHeader><CardTitle>New Store</CardTitle></CardHeader>
          <CardContent>
            <form onSubmit={handleCreate} className="grid grid-cols-1 md:grid-cols-2 gap-4">
              <Input placeholder="Store Name" value={form.name} onChange={e => setForm({...form, name:e.target.value})} required />
              <select className="flex h-10 rounded-md border border-input bg-background px-3 py-2 text-sm" value={form.type} onChange={e => setForm({...form, type:e.target.value})}>
                <option value="CUSTOMER">Customer Store</option>
                <option value="DISTRIBUTION">Distribution Hub</option>
              </select>
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
              {form.type === 'CUSTOMER' && (
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
                  <div>
                    <label className="text-sm font-medium block mb-1">Assign Store Manager</label>
                    <select className="flex h-10 w-full rounded-md border border-input bg-background px-3 py-2 text-sm" value={form.managerUid} onChange={e => setForm({...form, managerUid:e.target.value})}>
                      <option value="">No manager</option>
                      {managers.map((m:any) => <option key={m.uid} value={m.uid}>{m.displayName || m.email || m.phone}</option>)}
                    </select>
                  </div>
                </div>
              )}
              <div className="md:col-span-2"><Button className="w-full sm:w-auto" type="submit">Create Store</Button></div>
            </form>
          </CardContent>
        </Card>
      )}
      <Card>
        <CardHeader><CardTitle>All Stores ({stores.length})</CardTitle></CardHeader>
        <CardContent>
          <DataTable
            data={stores}
            columns={[
              { key: 'name', header: 'Name' },
              { key: 'type', header: 'Type', render: (s) => <Badge variant={s.type === 'DISTRIBUTION' ? 'default' : 'outline'}>{s.type}</Badge> },
              { key: 'city', header: 'City' },
              { key: 'phone', header: 'Phone' },
              { key: 'approvalStatus', header: 'Status', render: (s) => <Badge variant={s.approvalStatus === 'APPROVED' ? 'success' : s.approvalStatus === 'REJECTED' ? 'destructive' : 'warning'}>{s.approvalStatus}</Badge> },
              { key: 'actions', header: 'Actions', render: (s) => (
                <div className="flex gap-1">
                  {s.approvalStatus === 'PENDING' && (
                    <>
                      <Button size="sm" variant="outline" className="text-green-600 h-8 px-2" onClick={() => handleApproval(s.id, 'APPROVED')}><Check className="h-3 w-3" /></Button>
                      <Button size="sm" variant="outline" className="text-red-600 h-8 px-2" onClick={() => handleApproval(s.id, 'REJECTED')}><X className="h-3 w-3" /></Button>
                    </>
                  )}
                  <Button size="sm" variant="outline" className="h-8 px-2" onClick={() => openEdit(s)}><Edit3 className="h-3 w-3" /></Button>
                  <Button size="sm" variant="outline" className="text-destructive h-8 px-2" onClick={() => handleDelete(s.id)}><Trash2 className="h-3 w-3" /></Button>
                </div>
              )},
            ]}
          />
        </CardContent>
      </Card>

      {/* Edit Store Modal */}
      {editingStore && (
        <Card>
          <CardHeader className="flex flex-row items-center justify-between">
            <div className="flex items-center gap-3">
              {editingStore.logoUrl ? (
                <img src={editingStore.logoUrl} alt={editingStore.name} className="h-10 w-10 rounded-md border object-cover" />
              ) : null}
              <CardTitle>Edit: {editingStore.name}</CardTitle>
            </div>
            <Button variant="ghost" size="sm" onClick={() => setEditingStore(null)}><X className="h-4 w-4" /></Button>
          </CardHeader>
          <CardContent>
            <div className="grid grid-cols-2 gap-3 mb-4 p-3 rounded-md bg-muted/50 text-sm">
              <div>
                <span className="text-muted-foreground">Current Owner: </span>
                <span className="font-medium">{customers.find((u: any) => u.uid === editingStore.ownerUid)?.displayName || customers.find((u: any) => u.uid === editingStore.ownerUid)?.email || editingStore.ownerUid || 'None'}</span>
              </div>
              <div>
                <span className="text-muted-foreground">Status: </span>
                <Badge variant={editingStore.approvalStatus === 'APPROVED' ? 'success' : editingStore.approvalStatus === 'REJECTED' ? 'destructive' : 'warning'}>{editingStore.approvalStatus}</Badge>
              </div>
            </div>
            <form onSubmit={handleEditSave} className="grid grid-cols-1 md:grid-cols-2 gap-4">
              <div>
                <label className="text-sm font-medium block mb-1">Store Name</label>
                <Input value={editingStore.name || ''} onChange={e => setEditingStore({ ...editingStore, name: e.target.value })} required />
              </div>
              <div>
                <label className="text-sm font-medium block mb-1">Phone</label>
                <Input value={editingStore.phone || ''} onChange={e => setEditingStore({ ...editingStore, phone: e.target.value })} />
              </div>
              <div>
                <label className="text-sm font-medium block mb-1">Email</label>
                <Input value={editingStore.email || ''} onChange={e => setEditingStore({ ...editingStore, email: e.target.value })} />
              </div>
              <div>
                <label className="text-sm font-medium block mb-1">Address</label>
                <Input value={editingStore.address || ''} onChange={e => setEditingStore({ ...editingStore, address: e.target.value })} />
              </div>
              <div>
                <label className="text-sm font-medium block mb-1">City</label>
                <Input value={editingStore.city || ''} onChange={e => setEditingStore({ ...editingStore, city: e.target.value })} />
              </div>
              <div>
                <label className="text-sm font-medium block mb-1">State</label>
                <Input value={editingStore.state || ''} onChange={e => setEditingStore({ ...editingStore, state: e.target.value })} />
              </div>
              <div>
                <label className="text-sm font-medium block mb-1">Pincode</label>
                <Input value={editingStore.pincode || ''} onChange={e => setEditingStore({ ...editingStore, pincode: e.target.value })} />
              </div>
              <div>
                <label className="text-sm font-medium block mb-1">Reassign Owner</label>
                <select className="flex h-10 w-full rounded-md border border-input bg-background px-3 py-2 text-sm"
                  value={editingStore.ownerUid || ''} onChange={e => setEditingStore({ ...editingStore, ownerUid: e.target.value || null })}>
                  <option value="">No owner</option>
                  {customers.map((u: any) => <option key={u.uid} value={u.uid}>{u.displayName || u.email || u.phone}</option>)}
                </select>
              </div>
              <div>
                <label className="text-sm font-medium block mb-1">Store Manager</label>
                <select className="flex h-10 w-full rounded-md border border-input bg-background px-3 py-2 text-sm"
                  value={editingStore.managerUid || ''} onChange={e => setEditingStore({ ...editingStore, managerUid: e.target.value || null })}>
                  <option value="">No manager</option>
                  {managers.map((m: any) => <option key={m.uid} value={m.uid}>{m.displayName || m.email || m.phone}</option>)}
                </select>
              </div>
              <div className="flex items-center gap-2">
                <label className="text-sm font-medium">Active</label>
                <input type="checkbox" checked={editingStore.isActive !== false} onChange={e => setEditingStore({ ...editingStore, isActive: e.target.checked })} className="h-4 w-4" />
              </div>
              <div className="md:col-span-2 flex gap-2">
                <Button type="submit">Save Changes</Button>
                <Button variant="outline" onClick={() => setEditingStore(null)}>Cancel</Button>
              </div>
            </form>
          </CardContent>
        </Card>
      )}
    </div>
  );
}
