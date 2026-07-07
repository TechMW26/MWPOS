'use client';
import { useState, useEffect } from 'react';
import { Card, CardHeader, CardTitle, CardContent } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Input } from '@/components/ui/input';
import { Button } from '@/components/ui/button';

export default function ProfilePage() {
  const [session, setSession] = useState<any>(null);
  const [stores, setStores] = useState<any[]>([]);
  const [form, setForm] = useState({ name:'', type:'CUSTOMER', address:'', city:'', state:'', pincode:'', phone:'', email:'' });
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    fetch('/api/auth/session').then(r => r.json()).then(d => { setSession(d); setLoading(false); });
    fetch('/api/stores?type=CUSTOMER&mine=1').then(r => r.json()).then(d => setStores(Array.isArray(d) ? d : []));
  }, []);

  async function addStore(e: React.FormEvent) {
    e.preventDefault();
    await fetch('/api/stores', { method:'POST', headers:{'Content-Type':'application/json'}, body: JSON.stringify(form) });
    setForm({ name:'', type:'CUSTOMER', address:'', city:'', state:'', pincode:'', phone:'', email:'' });
    const data = await fetch('/api/stores?type=CUSTOMER&mine=1').then(r => r.json());
    setStores(Array.isArray(data) ? data : []);
  }

  if (loading) return <div className="p-6 text-muted-foreground">Loading...</div>;
  if (!session?.authenticated) return <div className="p-6 text-muted-foreground">Not logged in</div>;

  const user = session.user;
  return (
    <div className="space-y-6">
      <Card className="max-w-lg">
        <CardHeader><CardTitle>Account Details</CardTitle></CardHeader>
        <CardContent className="space-y-4">
          <div><label className="text-sm text-muted-foreground">Name</label><p className="font-medium">{user.displayName}</p></div>
          <div><label className="text-sm text-muted-foreground">Email</label><p className="font-medium">{user.email || '—'}</p></div>
          <div><label className="text-sm text-muted-foreground">Phone</label><p className="font-medium">{user.phone || '—'}</p></div>
          <div><label className="text-sm text-muted-foreground">Role</label><p><Badge>{user.role}</Badge></p></div>
          {user.approvalStatus && <div><label className="text-sm text-muted-foreground">Approval Status</label><p><Badge variant={user.approvalStatus === 'APPROVED' ? 'success' : 'warning'}>{user.approvalStatus}</Badge></p></div>}
        </CardContent>
      </Card>
      <Card>
        <CardHeader><CardTitle>My Stores ({stores.length})</CardTitle></CardHeader>
        <CardContent className="space-y-4">
          <div className="grid grid-cols-1 gap-3 md:grid-cols-2">
            {stores.map((store:any) => (
              <div key={store.id} className="rounded-md border p-3">
                <p className="font-medium">{store.name}</p>
                <p className="text-sm text-muted-foreground">{store.address}, {store.city}, {store.state} {store.pincode}</p>
                <p className="text-xs text-muted-foreground mt-1">{store.phone}</p>
              </div>
            ))}
          </div>
          <form onSubmit={addStore} className="grid grid-cols-1 gap-3 border-t pt-4 md:grid-cols-2">
            <Input placeholder="Store name" value={form.name} onChange={e => setForm({...form, name:e.target.value})} required />
            <Input placeholder="Phone" value={form.phone} onChange={e => setForm({...form, phone:e.target.value})} required />
            <Input placeholder="Email (optional)" value={form.email} onChange={e => setForm({...form, email:e.target.value})} />
            <Input placeholder="Address" value={form.address} onChange={e => setForm({...form, address:e.target.value})} required />
            <Input placeholder="City" value={form.city} onChange={e => setForm({...form, city:e.target.value})} required />
            <Input placeholder="State" value={form.state} onChange={e => setForm({...form, state:e.target.value})} required />
            <Input placeholder="Pincode" value={form.pincode} onChange={e => setForm({...form, pincode:e.target.value})} required />
            <div className="md:col-span-2"><Button className="w-full sm:w-auto" type="submit">Add My Store</Button></div>
          </form>
        </CardContent>
      </Card>
    </div>
  );
}
