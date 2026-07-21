'use client';

import { useState } from 'react';
import { Card, CardHeader, CardTitle, CardContent } from '@/components/ui/card';
import { DataTable } from '@/components/ui/data-table';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Modal } from '@/components/ui/modal';
import { UserPlus, Loader2, X, Check, Trash2, Edit3 } from 'lucide-react';
import { useRealtimeList } from '@/lib/hooks/use-realtime-list';

const roleColors: Record<string, "default" | "success" | "warning" | "destructive" | "outline"> = {
  SUPERADMIN: "destructive", ADMIN: "default", ASM: "warning", C_AND_F: "outline", DISTRIBUTOR: "success",
};

export default function UsersPage() {
  const [showAddUser, setShowAddUser] = useState(false);
  const [addForm, setAddForm] = useState({ phone: '', displayName: '', role: 'ASM' });
  const [adding, setAdding] = useState(false);
  const [actionMsg, setActionMsg] = useState('');
  const [editingUser, setEditingUser] = useState<any>(null);
  const [editForm, setEditForm] = useState({ email: '', phone: '', displayName: '', role: 'ASM', approvalStatus: '', districtId: '', cfId: '', avatarUrl: '', isActive: true });

  const { data: users, loading, error, live } = useRealtimeList({ path: 'users', fallbackUrl: '/api/users' });

  async function handleAddUser(e: React.FormEvent) {
    e.preventDefault();
    if (!addForm.phone) { setActionMsg('Phone number required'); return; }
    setAdding(true); setActionMsg('');
    try {
      const res = await fetch('/api/users', {
        method: 'POST', headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          phone: addForm.phone,
          displayName: addForm.displayName || addForm.phone,
          role: addForm.role,
        }),
      });
      if (!res.ok) {
        const data = await res.json();
        throw new Error(data.message || 'Failed to create user');
      }
      setActionMsg('User created successfully');
      setShowAddUser(false);
      setAddForm({ phone: '', displayName: '', role: 'ASM' });
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
    setEditForm({
      email: user.email || '',
      phone: user.phone || '',
      displayName: user.displayName || '',
      role: user.role || 'ASM',
      approvalStatus: user.approvalStatus || '',
      districtId: user.districtId || '',
      cfId: user.cfId || '',
      avatarUrl: user.avatarUrl || '',
      isActive: user.isActive,
    });
  }

  async function handleEditSave() {
    if (!editingUser) return;
    await fetch('/api/users', {
      method: 'PATCH', headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        uid: editingUser.uid,
        email: editForm.email || null,
        phone: editForm.phone || null,
        displayName: editForm.displayName,
        role: editForm.role,
        approvalStatus: editForm.approvalStatus || undefined,
        districtId: editForm.districtId || null,
        cfId: editForm.cfId || null,
        avatarUrl: editForm.avatarUrl || null,
        isActive: editForm.isActive,
      }),
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

      <Modal open={showAddUser} title="Add New User" onClose={() => setShowAddUser(false)} className="max-w-2xl">
            <form onSubmit={handleAddUser} className="space-y-4">
              <div>
                <label className="text-sm font-medium block mb-1">Phone Number</label>
                <Input type="tel" inputMode="tel" autoComplete="tel" placeholder="+91 98765 43210" value={addForm.phone}
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
                  <option value="ASM">ASM (Area Sales Manager)</option>
                  <option value="C_AND_F">C&amp;F (Carry &amp; Forward)</option>
                  <option value="DISTRIBUTOR">Distributor Owner</option>
                  <option value="ADMIN">Admin</option>
                  <option value="SUPERADMIN">Superadmin</option>
                </select>
              </div>
              <Button className="w-full sm:w-auto" type="submit" disabled={adding}>
                {adding && <Loader2 className="h-4 w-4 mr-2 animate-spin" />}
                {adding ? 'Creating...' : 'Create User'}
              </Button>
            </form>
      </Modal>

      <Modal open={!!editingUser} title={`Edit: ${editingUser?.email || editingUser?.phone || editingUser?.uid || 'User'}`} onClose={() => setEditingUser(null)} className="max-w-3xl">
          <div className="space-y-4">
            <div className="grid grid-cols-1 gap-4 md:grid-cols-2">
            <div>
              <label className="text-sm font-medium block mb-1">Display Name</label>
              <Input value={editForm.displayName} onChange={e => setEditForm({ ...editForm, displayName: e.target.value })} />
            </div>
            <div>
              <label className="text-sm font-medium block mb-1">Email</label>
              <Input type="email" value={editForm.email} onChange={e => setEditForm({ ...editForm, email: e.target.value })} />
            </div>
            <div>
              <label className="text-sm font-medium block mb-1">Phone</label>
              <Input value={editForm.phone} onChange={e => setEditForm({ ...editForm, phone: e.target.value })} />
            </div>
            <div>
              <label className="text-sm font-medium block mb-1">Role</label>
              <select className="flex h-10 w-full rounded-md border border-input bg-background px-3 py-2 text-sm" value={editForm.role} onChange={e => setEditForm({ ...editForm, role: e.target.value })}>
                <option value="ASM">ASM</option>
                <option value="C_AND_F">C&amp;F</option>
                <option value="DISTRIBUTOR">Distributor</option>
                <option value="ADMIN">Admin</option>
                <option value="SUPERADMIN">Superadmin</option>
              </select>
            </div>
            <div>
              <label className="text-sm font-medium block mb-1">Approval Status</label>
              <select className="flex h-10 w-full rounded-md border border-input bg-background px-3 py-2 text-sm" value={editForm.approvalStatus} onChange={e => setEditForm({ ...editForm, approvalStatus: e.target.value })}>
                <option value="">Not required</option>
                <option value="PENDING">Pending</option>
                <option value="APPROVED">Approved</option>
                <option value="REJECTED">Rejected</option>
              </select>
            </div>
            <div>
              <label className="text-sm font-medium block mb-1">District ID</label>
              <Input value={editForm.districtId} onChange={e => setEditForm({ ...editForm, districtId: e.target.value })} />
            </div>
            <div>
              <label className="text-sm font-medium block mb-1">C&amp;F ID</label>
              <Input value={editForm.cfId} onChange={e => setEditForm({ ...editForm, cfId: e.target.value })} />
            </div>
            <div>
              <label className="text-sm font-medium block mb-1">Avatar URL</label>
              <Input value={editForm.avatarUrl} onChange={e => setEditForm({ ...editForm, avatarUrl: e.target.value })} />
            </div>
            </div>
            <div className="flex items-center gap-2">
              <label className="text-sm font-medium">Active</label>
              <input type="checkbox" checked={editForm.isActive} onChange={e => setEditForm({ ...editForm, isActive: e.target.checked })} className="h-4 w-4" />
            </div>
            <Button onClick={handleEditSave}>Save Changes</Button>
          </div>
      </Modal>

      {loading ? (
        <div className="flex items-center justify-center py-16">
          <Loader2 className="h-8 w-8 animate-spin text-muted-foreground" />
          <span className="ml-3 text-muted-foreground">Loading users...</span>
        </div>
      ) : error ? (
        <Card className="border-destructive"><CardContent className="p-4 text-center">
          <p className="text-destructive font-medium">{error}</p>
        </CardContent></Card>
      ) : (
        <Card><CardHeader><CardTitle>All Users ({users.length})</CardTitle></CardHeader><CardContent>
          <DataTable data={users} columns={[
            { key: 'phone', header: 'Phone', render: (u) => u.phone || '—' },
            { key: 'displayName', header: 'Name' },
            { key: 'role', header: 'Role', render: (u) => (
              <select className="h-8 rounded border px-2 text-xs font-medium bg-background" value={u.role}
                onChange={(e) => handleRoleChange(u.uid, e.target.value)} onClick={(e) => e.stopPropagation()}>
                <option value="ASM">ASM</option>
                <option value="C_AND_F">C&amp;F</option>
                <option value="DISTRIBUTOR">Distributor</option>
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
