'use client';

import { useState } from 'react';
import { Card, CardHeader, CardTitle, CardContent } from '@/components/ui/card';
import { DataTable } from '@/components/ui/data-table';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { UserPlus, Loader2, X } from 'lucide-react';
import { useRealtimeList } from '@/lib/hooks/use-realtime-list';

const roleColors: Record<string, "default" | "success" | "warning" | "destructive" | "outline"> = {
  SUPERADMIN: "destructive", ADMIN: "default", STORE_MANAGER: "warning", CUSTOMER: "outline",
};

export default function UsersPage() {
  const [showAddUser, setShowAddUser] = useState(false);
  const [addForm, setAddForm] = useState({ email: '', role: 'CUSTOMER' });
  const [adding, setAdding] = useState(false);
  const [actionMsg, setActionMsg] = useState('');

  const { data: users, loading, error, live } = useRealtimeList({ path: 'users', fallbackUrl: '/api/users' });

  async function handleAddUser(e: React.FormEvent) {
    e.preventDefault(); setAdding(true); setActionMsg('');
    try {
      const otpRes = await fetch('/api/auth/request-otp', {
        method: 'POST', headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ channel: 'email', destination: addForm.email }),
      });
      if (!otpRes.ok) throw new Error('Failed to create user');
      await new Promise(r => setTimeout(r, 800));
      if (addForm.role !== 'CUSTOMER') {
        const usersRes = await fetch('/api/users');
        const allUsers = await usersRes.json();
        const newUser = (Array.isArray(allUsers) ? allUsers : []).find((u: any) => u.email === addForm.email);
        if (newUser) {
          await fetch('/api/users', {
            method: 'PATCH', headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ uid: newUser.uid, role: addForm.role }),
          });
        }
      }
      setActionMsg('User created: ' + addForm.email);
      setShowAddUser(false); setAddForm({ email: '', role: 'CUSTOMER' });
    } catch (e: any) {
      setActionMsg('Error: ' + (e.message || 'Failed'));
    } finally { setAdding(false); }
  }

  async function handleRoleChange(uid: string, newRole: string) {
    try {
      await fetch('/api/users', {
        method: 'PATCH', headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ uid, role: newRole }),
      });
      setActionMsg('Role updated');
    } catch { setActionMsg('Failed to update role'); }
  }

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between gap-3">
        <p className="text-sm text-muted-foreground">{live ? 'Live updates on' : 'Auto refresh on'}</p>
        <Button className="w-full sm:w-auto" onClick={() => setShowAddUser(true)}><UserPlus className="h-4 w-4 mr-2" />Add User</Button>
      </div>

      {actionMsg && (
        <div className="flex items-center gap-2 p-3 rounded-md bg-muted text-sm">
          <span>{actionMsg}</span><button onClick={() => setActionMsg('')} className="ml-auto"><X className="h-3 w-3" /></button>
        </div>
      )}

      {showAddUser && (
        <Card>
          <CardHeader className="flex flex-row items-center justify-between">
            <CardTitle>Add New User</CardTitle>
            <Button variant="ghost" size="sm" onClick={() => setShowAddUser(false)}><X className="h-4 w-4" /></Button>
          </CardHeader>
          <CardContent>
            <form onSubmit={handleAddUser} className="space-y-4">
              <div>
                <label className="text-sm font-medium block mb-1">Email Address</label>
                <Input type="email" placeholder="user@example.com" required value={addForm.email}
                  onChange={e => setAddForm({ ...addForm, email: e.target.value })} />
                <p className="text-xs text-muted-foreground mt-1">User will receive OTP for first login</p>
              </div>
              <div>
                <label className="text-sm font-medium block mb-1">Role</label>
                <select className="flex h-10 w-full rounded-md border border-input bg-background px-3 py-2 text-sm"
                  value={addForm.role} onChange={e => setAddForm({ ...addForm, role: e.target.value })}>
                  <option value="CUSTOMER">Customer</option>
                  <option value="STORE_MANAGER">Store Manager</option>
                  <option value="ADMIN">Admin</option>
                  <option value="SUPERADMIN">Superadmin</option>
                </select>
              </div>
              <Button className="w-full sm:w-auto" type="submit" disabled={adding || !addForm.email}>
                {adding && <Loader2 className="h-4 w-4 mr-2 animate-spin" />}
                {adding ? 'Creating...' : 'Create User'}
              </Button>
            </form>
          </CardContent>
        </Card>
      )}

      {loading ? (
        <div className="flex items-center justify-center py-16">
          <Loader2 className="h-8 w-8 animate-spin text-muted-foreground" />
          <span className="ml-3 text-muted-foreground">Loading users...</span>
        </div>
      ) : error ? (
        <Card className="border-destructive"><CardContent className="py-8 text-center">
          <p className="text-destructive font-medium">{error}</p>
        </CardContent></Card>
      ) : (
        <Card><CardHeader><CardTitle>All Users ({users.length})</CardTitle></CardHeader><CardContent>
          <DataTable data={users} columns={[
            { key: 'email', header: 'Email', render: (u) => u.email || u.phone || '—' },
            { key: 'role', header: 'Role', render: (u) => (
              <select className="h-8 rounded border px-2 text-xs font-medium bg-background" value={u.role}
                onChange={(e) => handleRoleChange(u.uid, e.target.value)} onClick={(e) => e.stopPropagation()}>
                <option value="CUSTOMER">Customer</option>
                <option value="STORE_MANAGER">Store Manager</option>
                <option value="ADMIN">Admin</option>
                <option value="SUPERADMIN">Superadmin</option>
              </select>
            )},
            { key: 'approvalStatus', header: 'Approval', render: (u) => u.approvalStatus
              ? <Badge variant={u.approvalStatus === 'APPROVED' ? 'success' : u.approvalStatus === 'REJECTED' ? 'destructive' : 'warning'}>{u.approvalStatus}</Badge>
              : <span className="text-muted-foreground text-xs">—</span> },
            { key: 'isActive', header: 'Active', render: (u) => u.isActive ? <Badge variant="success">Yes</Badge> : <Badge variant="destructive">No</Badge> },
            { key: 'createdAt', header: 'Joined', render: (u) => new Date(u.createdAt).toLocaleDateString() },
          ]} emptyMessage="No users found. Click 'Add User' to create one." />
        </CardContent></Card>
      )}
    </div>
  );
}
