'use client';

import { useEffect, useMemo, useState } from 'react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { DataTable } from '@/components/ui/data-table';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Modal } from '@/components/ui/modal';
import { StatCard } from '@/components/ui/stat-card';
import { CheckSquare, Edit3, Loader2, Square, Users } from 'lucide-react';

interface UserRow extends Record<string, unknown> {
  uid: string;
  email: string | null;
  phone: string | null;
  displayName: string;
  role: string;
  approvalStatus: string | null;
  isActive: boolean;
  districtId: string | null;
  cfId: string | null;
  createdAt: string;
}

const emptyEdit = { email: '', phone: '', displayName: '', approvalStatus: '', districtId: '', avatarUrl: '', isActive: true };

export default function CfsPage() {
  const [users, setUsers] = useState<UserRow[]>([]);
  const [loading, setLoading] = useState(true);
  const [selectedCfId, setSelectedCfId] = useState('');
  const [selectedAsmIds, setSelectedAsmIds] = useState<string[]>([]);
  const [editingCf, setEditingCf] = useState<UserRow | null>(null);
  const [editForm, setEditForm] = useState(emptyEdit);
  const [saving, setSaving] = useState(false);
  const [message, setMessage] = useState('');

  async function load() {
    setLoading(true);
    try {
      const res = await fetch('/api/users');
      const data = await res.json();
      const list = Array.isArray(data) ? data : [];
      setUsers(list);
      const firstCf = list.find((u: UserRow) => u.role === 'C_AND_F')?.uid || '';
      setSelectedCfId(current => current || firstCf);
    } finally {
      setLoading(false);
    }
  }

  useEffect(() => { load(); }, []);

  const cfs = useMemo(() => users.filter(u => u.role === 'C_AND_F'), [users]);
  const asms = useMemo(() => users.filter(u => u.role === 'ASM'), [users]);
  const selectedCf = cfs.find(cf => cf.uid === selectedCfId) || null;
  const assignedAsms = asms.filter(asm => asm.cfId === selectedCfId);
  const unassignedAsms = asms.filter(asm => !asm.cfId);

  function toggleAsm(uid: string) {
    setSelectedAsmIds(ids => ids.includes(uid) ? ids.filter(id => id !== uid) : [...ids, uid]);
  }

  function selectVisible(ids: string[]) {
    setSelectedAsmIds(current => {
      const next = new Set(current);
      ids.forEach(id => next.add(id));
      return Array.from(next);
    });
  }

  async function patchUser(uid: string, updates: Record<string, unknown>) {
    const res = await fetch('/api/users', {
      method: 'PATCH',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ uid, ...updates }),
    });
    if (!res.ok) {
      const data = await res.json().catch(() => null);
      throw new Error(data?.message || 'Failed to update user');
    }
  }

  async function assignSelected() {
    if (!selectedCfId || selectedAsmIds.length === 0) return;
    setSaving(true); setMessage('');
    try {
      await Promise.all(selectedAsmIds.map(uid => patchUser(uid, { cfId: selectedCfId })));
      setMessage(`Assigned ${selectedAsmIds.length} ASM(s) to ${selectedCf?.displayName || 'C&F'}`);
      setSelectedAsmIds([]);
      await load();
    } catch (error) {
      setMessage(error instanceof Error ? error.message : 'Assignment failed');
    } finally {
      setSaving(false);
    }
  }

  async function unassignSelected() {
    if (selectedAsmIds.length === 0) return;
    setSaving(true); setMessage('');
    try {
      await Promise.all(selectedAsmIds.map(uid => patchUser(uid, { cfId: null })));
      setMessage(`Unassigned ${selectedAsmIds.length} ASM(s)`);
      setSelectedAsmIds([]);
      await load();
    } catch (error) {
      setMessage(error instanceof Error ? error.message : 'Unassignment failed');
    } finally {
      setSaving(false);
    }
  }

  function openEdit(cf: UserRow) {
    setEditingCf(cf);
    setEditForm({
      email: cf.email || '',
      phone: cf.phone || '',
      displayName: cf.displayName || '',
      approvalStatus: cf.approvalStatus || '',
      districtId: cf.districtId || '',
      avatarUrl: '',
      isActive: cf.isActive,
    });
  }

  async function saveCf() {
    if (!editingCf) return;
    setSaving(true); setMessage('');
    try {
      await patchUser(editingCf.uid, {
        email: editForm.email || null,
        phone: editForm.phone || null,
        displayName: editForm.displayName,
        role: 'C_AND_F',
        approvalStatus: editForm.approvalStatus || undefined,
        districtId: editForm.districtId || null,
        avatarUrl: editForm.avatarUrl || null,
        isActive: editForm.isActive,
      });
      setEditingCf(null);
      await load();
    } catch (error) {
      setMessage(error instanceof Error ? error.message : 'Save failed');
    } finally {
      setSaving(false);
    }
  }

  if (loading) {
    return <div className="flex items-center gap-2 p-6 text-muted-foreground"><Loader2 className="h-4 w-4 animate-spin" />Loading C&amp;F users...</div>;
  }

  return (
    <div className="space-y-6">
      <p className="text-muted-foreground">Edit C&amp;F users and bulk assign ASMs.</p>

      {message && <div className="rounded-md border bg-muted p-3 text-sm">{message}</div>}

      <div className="grid gap-4 md:grid-cols-3">
        <StatCard title="C&F Users" value={cfs.length} icon={<Users className="h-4 w-4" />} />
        <StatCard title="Assigned ASMs" value={asms.filter(a => a.cfId).length} icon={<CheckSquare className="h-4 w-4" />} />
        <StatCard title="Unassigned ASMs" value={unassignedAsms.length} icon={<Square className="h-4 w-4" />} />
      </div>

      <Card>
        <CardHeader><CardTitle>All C&amp;F Users ({cfs.length})</CardTitle></CardHeader>
        <CardContent>
          <DataTable data={cfs} columns={[
            { key: 'displayName', header: 'Name' },
            { key: 'email', header: 'Email/Phone', render: u => u.email || u.phone || '-' },
            { key: 'assigned', header: 'ASMs', render: u => asms.filter(a => a.cfId === u.uid).length },
            { key: 'isActive', header: 'Active', render: u => <Badge variant={u.isActive ? 'success' : 'destructive'}>{u.isActive ? 'Yes' : 'No'}</Badge> },
            { key: 'actions', header: 'Actions', render: u => <Button size="sm" variant="outline" onClick={() => openEdit(u)}><Edit3 className="h-3 w-3 mr-1" />Edit</Button> },
          ]} emptyMessage="No C&F users found. Create one from Users first." />
        </CardContent>
      </Card>

      <Card>
        <CardHeader><CardTitle>Bulk Assign ASMs</CardTitle></CardHeader>
        <CardContent className="space-y-4">
          <div className="grid gap-3 md:grid-cols-[1fr_auto_auto_auto] md:items-end">
            <div>
              <label className="mb-1 block text-sm font-medium">Assign to C&amp;F</label>
              <select className="flex h-10 w-full rounded-md border border-input bg-background px-3 py-2 text-sm" value={selectedCfId} onChange={e => setSelectedCfId(e.target.value)}>
                <option value="">Select C&amp;F</option>
                {cfs.map(cf => <option key={cf.uid} value={cf.uid}>{cf.displayName || cf.email || cf.phone}</option>)}
              </select>
            </div>
            <Button type="button" variant="outline" onClick={() => selectVisible(unassignedAsms.map(a => a.uid))}>Select unassigned</Button>
            <Button type="button" onClick={assignSelected} disabled={!selectedCfId || selectedAsmIds.length === 0 || saving}>Assign selected</Button>
            <Button type="button" variant="destructive" onClick={unassignSelected} disabled={selectedAsmIds.length === 0 || saving}>Unassign selected</Button>
          </div>

          <DataTable data={asms} columns={[
            { key: 'select', header: '', render: asm => <input type="checkbox" checked={selectedAsmIds.includes(asm.uid)} onChange={() => toggleAsm(asm.uid)} className="h-4 w-4" /> },
            { key: 'displayName', header: 'ASM' },
            { key: 'email', header: 'Email/Phone', render: asm => asm.email || asm.phone || '-' },
            { key: 'districtId', header: 'District', render: asm => asm.districtId || '-' },
            { key: 'cfId', header: 'Assigned C&F', render: asm => cfs.find(cf => cf.uid === asm.cfId)?.displayName || (asm.cfId ? asm.cfId.slice(0, 8) : <span className="text-muted-foreground">Unassigned</span>) },
            { key: 'status', header: 'Status', render: asm => <Badge variant={asm.isActive ? 'success' : 'destructive'}>{asm.isActive ? 'Active' : 'Inactive'}</Badge> },
          ]} emptyMessage="No ASM users found." />
        </CardContent>
      </Card>

      {selectedCf && (
        <Card>
          <CardHeader><CardTitle>ASMs under {selectedCf.displayName || selectedCf.email}</CardTitle></CardHeader>
          <CardContent>
            <DataTable data={assignedAsms} columns={[
              { key: 'displayName', header: 'ASM' },
              { key: 'email', header: 'Email/Phone', render: asm => asm.email || asm.phone || '-' },
              { key: 'districtId', header: 'District', render: asm => asm.districtId || '-' },
              { key: 'isActive', header: 'Active', render: asm => <Badge variant={asm.isActive ? 'success' : 'destructive'}>{asm.isActive ? 'Yes' : 'No'}</Badge> },
            ]} emptyMessage="No ASMs assigned to this C&F." />
          </CardContent>
        </Card>
      )}

      <Modal open={!!editingCf} title="Edit C&F User" onClose={() => setEditingCf(null)} className="max-w-3xl">
        <div className="space-y-4">
          <div className="grid grid-cols-1 gap-4 md:grid-cols-2">
            <div><label className="text-sm font-medium block mb-1">Display Name</label><Input value={editForm.displayName} onChange={e => setEditForm({ ...editForm, displayName: e.target.value })} /></div>
            <div><label className="text-sm font-medium block mb-1">Email</label><Input value={editForm.email} onChange={e => setEditForm({ ...editForm, email: e.target.value })} /></div>
            <div><label className="text-sm font-medium block mb-1">Phone</label><Input value={editForm.phone} onChange={e => setEditForm({ ...editForm, phone: e.target.value })} /></div>
            <div><label className="text-sm font-medium block mb-1">Approval Status</label><select className="flex h-10 w-full rounded-md border border-input bg-background px-3 py-2 text-sm" value={editForm.approvalStatus} onChange={e => setEditForm({ ...editForm, approvalStatus: e.target.value })}><option value="">Not required</option><option value="PENDING">Pending</option><option value="APPROVED">Approved</option><option value="REJECTED">Rejected</option></select></div>
            <div><label className="text-sm font-medium block mb-1">District ID</label><Input value={editForm.districtId} onChange={e => setEditForm({ ...editForm, districtId: e.target.value })} /></div>
            <div><label className="text-sm font-medium block mb-1">Avatar URL</label><Input value={editForm.avatarUrl} onChange={e => setEditForm({ ...editForm, avatarUrl: e.target.value })} /></div>
          </div>
          <label className="flex items-center gap-2 text-sm font-medium"><input type="checkbox" checked={editForm.isActive} onChange={e => setEditForm({ ...editForm, isActive: e.target.checked })} className="h-4 w-4" />Active</label>
          <Button onClick={saveCf} disabled={saving}>{saving ? 'Saving...' : 'Save Changes'}</Button>
        </div>
      </Modal>
    </div>
  );
}
