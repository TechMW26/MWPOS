'use client';

import { useState } from 'react';
import { Card, CardHeader, CardTitle, CardContent } from '@/components/ui/card';
import { DataTable } from '@/components/ui/data-table';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Check, X, UserPlus, Loader2 } from 'lucide-react';
import { useRealtimeList } from '@/lib/hooks/use-realtime-list';

export default function StoreManagersPage() {
  const [showAdd, setShowAdd] = useState(false);
  const [addEmail, setAddEmail] = useState('');
  const [adding, setAdding] = useState(false);
  const [actionMsg, setActionMsg] = useState('');
  const { data: liveManagers, loading, error, live } = useRealtimeList({
    path: 'users',
    fallbackUrl: '/api/users?role=STORE_MANAGER',
    orderChild: 'role',
    equalValue: 'STORE_MANAGER',
  });
  const managers = liveManagers;

  async function handleAdd(e: React.FormEvent) {
    e.preventDefault(); setAdding(true); setActionMsg('');
    try {
      const otpRes = await fetch('/api/auth/request-otp', {
        method: 'POST', headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ channel: 'email', destination: addEmail }),
      });
      if (!otpRes.ok) throw new Error('Failed');
      await new Promise(r => setTimeout(r, 800));
      const usersRes = await fetch('/api/users');
      const all = await usersRes.json();
      const newUser = (Array.isArray(all) ? all : []).find((u: any) => u.email === addEmail);
      if (newUser) {
        await fetch('/api/users', {
          method: 'PATCH', headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ uid: newUser.uid, role: 'STORE_MANAGER' }),
        });
      }
      setActionMsg('Store manager created: ' + addEmail);
      setShowAdd(false); setAddEmail('');
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
        <Button className="w-full sm:w-auto" onClick={() => setShowAdd(true)}><UserPlus className="h-4 w-4 mr-2" />Add Manager</Button>
      </div>

      {actionMsg && (
        <div className="flex items-center gap-2 p-3 rounded-md bg-muted text-sm">
          <span>{actionMsg}</span><button onClick={() => setActionMsg('')} className="ml-auto"><X className="h-3 w-3" /></button>
        </div>
      )}

      {showAdd && (
        <Card>
          <CardHeader className="flex flex-row items-center justify-between">
            <CardTitle>Add Store Manager</CardTitle>
            <Button variant="ghost" size="sm" onClick={() => setShowAdd(false)}><X className="h-4 w-4" /></Button>
          </CardHeader>
          <CardContent>
            <form onSubmit={handleAdd} className="space-y-4">
              <div>
                <label className="text-sm font-medium block mb-1">Email Address</label>
                <Input type="email" placeholder="manager@example.com" required value={addEmail}
                  onChange={e => setAddEmail(e.target.value)} />
                <p className="text-xs text-muted-foreground mt-1">New manager will need OTP verification on first login. Requires superadmin approval after creation.</p>
              </div>
              <Button className="w-full sm:w-auto" type="submit" disabled={adding || !addEmail}>
                {adding && <Loader2 className="h-4 w-4 mr-2 animate-spin" />}
                {adding ? 'Creating...' : 'Create Store Manager'}
              </Button>
            </form>
          </CardContent>
        </Card>
      )}

      {loading ? (
        <div className="flex items-center justify-center py-16">
          <Loader2 className="h-8 w-8 animate-spin text-muted-foreground" />
          <span className="ml-3 text-muted-foreground">Loading...</span>
        </div>
      ) : error ? (
        <Card className="border-destructive"><CardContent className="py-8 text-center">
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
            <CardHeader><CardTitle>All Managers ({managers.length})</CardTitle></CardHeader>
            <CardContent>
              <DataTable data={managers} columns={[
                { key: 'email', header: 'Email' },
                { key: 'approvalStatus', header: 'Status', render: (m) => {
                  const s = m.approvalStatus;
                  return <Badge variant={s === 'APPROVED' ? 'success' : s === 'REJECTED' ? 'destructive' : 'warning'}>{s || 'N/A'}</Badge>;
                }},
                { key: 'isActive', header: 'Active', render: (m) => m.isActive ? <Badge variant="success">Yes</Badge> : <Badge variant="destructive">No</Badge> },
                { key: 'createdAt', header: 'Joined', render: (m) => new Date(m.createdAt).toLocaleDateString() },
              ]} emptyMessage="No store managers. Click 'Add Manager' to create one." />
            </CardContent>
          </Card>
        </>
      )}
    </div>
  );
}
