'use client';

import { useState } from 'react';
import { Card, CardHeader, CardTitle, CardContent } from '@/components/ui/card';
import { DataTable } from '@/components/ui/data-table';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { UserPlus, Loader2, X, Check, Trash2, Edit3 } from 'lucide-react';
import { useRealtimeList } from '@/lib/hooks/use-realtime-list';

const roleColors: Record<string, "default" | "success" | "warning" | "destructive" | "outline"> = {
  SUPERADMIN: "destructive", ADMIN: "default", STORE_MANAGER: "warning", CUSTOMER: "outline",
};

export default function UsersPage() {
  const [showAddUser, setShowAddUser] = useState(false);
  const [addForm, setAddForm] = useState({ email: '', phone: '', displayName: '', role: 'STORE_MANAGER' });
  const [adding, setAdding] = useState(false);
  const [actionMsg, setActionMsg] = useState('');
  const [editingUser, setEditingUser] = useState<any>(null);
  const [editForm, setEditForm] = useState({ displayName: '', isActive: true });

  const { data: users, loading, error, live } = useRealtimeList({ path: 'users', fallbackUrl: '/api/users' });

  async function handleAddUser(e: React.FormEvent) {
    e.preventDefault();
    if (!addForm.email && !addForm.phone) { setActionMsg('Email or phone required'); return; }
    setAdding(true); setActionMsg('');
    try {
      const res = await fetch('/api/users', {
        method: 'POST', headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          email: addForm.email || null,
          phone: addForm.phone || null,
          displayName: addForm.displayName || addForm.email || addForm.phone,
          role: addForm.role,
        }),
      });
      if (!res.ok) {
        const data = await res.json();
        throw new Error(data.message || 'Failed to create user');
      }
      setActionMsg('User created successfully');
      setShowAddUser(false);
      setAddForm({ email: '', phone: '', displayName: '', role: 'STORE_MANAGER' });
    } catch (e: any) {
      setActionMsg('Error: ' + (e.message || 'Failed'));
    } finally { setAdding(false); }
  }

  async function handleRoleChange(uid: string, newRole: string) {
    await fetch('/api/users', {
      method: 'PATCH', headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ uid, role: newRole }),
    });
  }

  async function handleApproval(uid: string, approvalStatus: 'APPROVED' | 'REJECTED') {
    await fetch('/api/users', {
      method: 'PATCH', headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ uid, approvalStatus }),
    });
    setActionMsg('Approval updated');
  }

  function openEdit(user: any) {
    setEditingUser(user);
    setEditForm({ displayName: user.displayName || '', isActive: user.isActive });
  }

  async function handleEditSave() {
    if (!editingUser) return;
    await fetch('/api/users', {
      method: 'PATCH', headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ uid: editingUser.uid, displayName: editForm.displayName, isActive: editForm.isActive }),
    });
    setActionMsg('User updated');
    setEditingUser(null);
  }

  async function handleDelete(uid: string) {
    if (!confirm('Delete this user? This cannot be undone.')) return;
    await fetch('/api/users?uid=' + uid, { method: 'DELETE' });
    setActionMsg('User deleted');
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
                <Input type="email" placeholder="user@example.com" value={addForm.email}
                  onChange={e => setAddForm({ ...addForm, email: e.target.value })} />
              </div>
              <div>
                <label className="text-sm font-medium block mb-1">Phone (optional)</label>
                <Input type="tel" placeholder="+91..." value={addForm.phone}
                  onChange={e => setAddForm({ ...addForm, phone: e.target.value })} />
              </div>
              <div>
                <label className="text-sm font-medium block mb-1">Display Name</label>
                <Input placeholder="John Doe" value={addForm.displayName}
                  onChange={e => setAddForm({ ...addForm, displayName: e.target.value })} />
              </div>
              <div>
                <label className="text-sm font-medium block mb-1">Role</label>
                <select className="flex h-10 w-full rounded-md border border-input bg-background px-3 py-2 text-sm"
                  value={addForm.role} onChange={e => setAddForm({ ...addForm, role: e.target.value })}>
                  <option value="STORE_MANAGER">Store Manager</option>
                  <option value="CUSTOMER">Customer</option>
                  <option value="ADMIN">Admin</option>
                  <option value="SUPERADMIN">Superadmin</option>
                </select>
              </div>
              <Button className="w-full sm:w-auto" type="submit" disabled={adding}>
                {adding && <Loader2 className="h-4 w-4 mr-2 animate-spin" />}
                {adding ? 'Creating...' : 'Create User'}
              </Button>
            </form>
          </CardContent>
        </Card>
      )}

      {editingUser && (
        <Card>
          <CardHeader className="flex flex-row items-center justify-between">
            <CardTitle>Edit: {editingUser.email || editingUser.phone}</CardTitle>
            <Button variant="ghost" size="sm" onClick={() => setEditingUser(null)}><X className="h-4 w-4" /></Button>
          </CardHeader>
          <CardContent className="space-y-4">
            <div>
              <label className="text-sm font-medium block mb-1">Display Name</label>
              <Input value={editForm.displayName} onChange={e => setEditForm({ ...editForm, displayName: e.target.value })} />
            </div>
            <div className="flex items-center gap-2">
              <label className="text-sm font-medium">Active</label>
              <input type="checkbox" checked={editForm.isActive} onChange={e => setEditForm({ ...editForm, isActive: e.target.checked })} className="h-4 w-4" />
            </div>
            <Button onClick={handleEditSave}>Save Changes</Button>
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
            { key: 'email', header: 'Email/Phone', render: (u) => u.email || u.phone || '—' },
            { key: 'displayName', header: 'Name' },
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
              ? (
                <div className="flex items-center gap-1">
                  <Badge variant={u.approvalStatus === 'APPROVED' ? 'success' : u.approvalStatus === 'REJECTED' ? 'destructive' : 'warning'}>{u.approvalStatus}</Badge>
                  {u.approvalStatus === 'PENDING' && (
                    <>
                      <Button size="sm" variant="outline" className="text-green-600 h-7 px-1.5" onClick={() => handleApproval(u.uid, 'APPROVED')}><Check className="h-3 w-3" /></Button>
                      <Button size="sm" variant="outline" className="text-red-600 h-7 px-1.5" onClick={() => handleApproval(u.uid, 'REJECTED')}><X className="h-3 w-3" /></Button>
                    </>
                  )}
                </div>
              ) : <span className="text-muted-foreground text-xs">—</span> },
            { key: 'isActive', header: 'Active', render: (u) => u.isActive ? <Badge variant="success">Yes</Badge> : <Badge variant="destructive">No</Badge> },
            { key: 'createdAt', header: 'Joined', render: (u) => new Date(u.createdAt).toLocaleDateString() },
            { key: 'actions', header: '', render: (u) => (
              <div className="flex gap-1">
                <Button size="sm" variant="ghost" className="h-7 px-1.5" onClick={() => openEdit(u)}><Edit3 className="h-3 w-3" /></Button>
                <Button size="sm" variant="ghost" className="h-7 px-1.5 text-destructive" onClick={() => handleDelete(u.uid)}><Trash2 className="h-3 w-3" /></Button>
              </div>
            )},
          ]} emptyMessage="No users found. Click 'Add User' to create one." />
        </CardContent></Card>
      )}
    </div>
  );
}
