'use client';

import { useState, useEffect } from 'react';
import { useParams } from 'next/navigation';
import { Card, CardHeader, CardTitle, CardContent } from '@/components/ui/card';
import { DataTable } from '@/components/ui/data-table';
import { StatCard } from '@/components/ui/stat-card';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Modal } from '@/components/ui/modal';
import { ArrowLeft, Store, TrendingUp, ClipboardList, DollarSign, Edit3, Target, Loader2, MapPin } from 'lucide-react';
import Link from 'next/link';
import { formatCurrency } from '@/lib/utils';
import { PhoneInput } from '@/components/ui/phone-input';

export default function AsmDetailPage() {
  const { uid } = useParams<{ uid: string }>();
  const [manager, setManager] = useState<any>(null);
  const [stores, setStores] = useState<any[]>([]);
  const [orders, setOrders] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const [editing, setEditing] = useState(false);
  const [targetRupees, setTargetRupees] = useState('');
  const [targetMonth, setTargetMonth] = useState(() => new Date().toISOString().slice(0, 7));
  const [currentTarget, setCurrentTarget] = useState<any>(null);
  const [targetLoading, setTargetLoading] = useState(false);
  const [targetSaving, setTargetSaving] = useState(false);
  const [targetMsg, setTargetMsg] = useState('');
  const [editForm, setEditForm] = useState({ phone: '', phoneCode: '+91', displayName: '', role: 'ASM', approvalStatus: '', districtId: '', cfId: '', avatarUrl: '', isActive: true });

  useEffect(() => {
    async function load() {
      try {
        const [usersRes, storesRes, ordersRes] = await Promise.all([
          fetch('/api/users?role=ASM'),
          fetch(`/api/distributors?asmUid=${encodeURIComponent(uid)}`),
          fetch(`/api/orders?asmId=${encodeURIComponent(uid)}`),
        ]);
        const users = await usersRes.json();
        const st = await storesRes.json();
        const managerOrders = await ordersRes.json();
        const mgr = (Array.isArray(users) ? users : []).find((u: any) => u.uid === uid);
        setManager(mgr || null);
        if (mgr) setEditForm({
          phone: mgr.phone || '',
          phoneCode: '+91',
          displayName: mgr.displayName || '',
          role: mgr.role || 'ASM',
          approvalStatus: mgr.approvalStatus || '',
          districtId: mgr.districtId || '',
          cfId: mgr.cfId || '',
          avatarUrl: mgr.avatarUrl || '',
          isActive: mgr.isActive,
        });
        const storeList = Array.isArray(st) ? st : [];
        setStores(storeList);
        setOrders(Array.isArray(managerOrders) ? managerOrders : []);
      } catch (e) { console.error(e); } finally { setLoading(false); }
    }
    load();
  }, [uid]);

  useEffect(() => { loadTarget(); }, [uid, targetMonth]);

  async function loadTarget() {
    setTargetLoading(true);
    try {
      const res = await fetch(`/api/targets?month=${targetMonth}`, { cache: 'no-store' });
      const data = await res.json();
      const targets = Array.isArray(data.targets) ? data.targets : [];
      setCurrentTarget(targets.find((t: any) => t.asmUid === uid) || null);
    } catch { setCurrentTarget(null); }
    finally { setTargetLoading(false); }
  }

  async function saveTarget(e: React.FormEvent) {
    e.preventDefault();
    const rupees = Number(targetRupees);
    if (!rupees || rupees <= 0) { setTargetMsg('Enter a valid amount'); return; }
    setTargetSaving(true); setTargetMsg('');
    try {
      const res = await fetch('/api/targets', {
        method: 'POST', headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ asmUid: uid, month: targetMonth, targetRupees: rupees }),
      });
      if (!res.ok) { const d = await res.json(); throw new Error(d.message || 'Failed'); }
      setTargetMsg('Revenue goal saved');
      await loadTarget();
    } catch (e: any) { setTargetMsg(e.message || 'Failed'); }
    finally { setTargetSaving(false); }
  }

  async function saveManager() {
    await fetch('/api/users', {
      method: 'PATCH',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        uid,
        email: null,
        phone: `${editForm.phoneCode} ${editForm.phone}` || null,
        displayName: editForm.displayName,
        role: editForm.role,
        approvalStatus: editForm.approvalStatus || undefined,
        districtId: editForm.districtId || null,
        cfId: editForm.cfId || null,
        avatarUrl: editForm.avatarUrl || null,
        isActive: editForm.isActive,
      }),
    });
    setManager({ ...manager, ...editForm, email: null, approvalStatus: editForm.approvalStatus || null, districtId: editForm.districtId || null, cfId: editForm.cfId || null, avatarUrl: editForm.avatarUrl || null });
    setEditing(false);
  }

  if (loading) return <div className="p-6 text-muted-foreground">Loading...</div>;
  if (!manager) return <div className="p-6 text-destructive">ASM not found</div>;

  const revenue = orders.reduce((s: number, o: any) => s + (o.totalPaise || 0), 0);
  const completedOrders = orders.filter((o: any) => o.status === 'DELIVERED' || o.status === 'COMPLETED');
  const pendingOrders = orders.filter((o: any) => o.status !== 'DELIVERED' && o.status !== 'COMPLETED' && o.status !== 'CANCELLED');
  const territories = Array.isArray(manager.locations) && manager.locations.length > 0
    ? manager.locations
    : manager.districtId
      ? [{ districtId: manager.districtId }]
      : [];

  return (
    <div className="space-y-6">
      <div className="flex items-center gap-4">
        <Link href="/superadmin/store-managers"><ArrowLeft className="h-5 w-5 text-muted-foreground hover:text-foreground" /></Link>
        <div>
          <p className="font-semibold">{manager.displayName || manager.phone}</p>
          <p className="text-sm text-muted-foreground">{manager.phone || ''}</p>
        </div>
        <Badge variant={manager.approvalStatus === 'APPROVED' ? 'success' : manager.approvalStatus === 'REJECTED' ? 'destructive' : 'warning'}>
          {manager.approvalStatus || 'N/A'}
        </Badge>
        <Badge variant={manager.isActive ? 'success' : 'destructive'}>{manager.isActive ? 'Active' : 'Inactive'}</Badge>
        <Button variant="outline" size="sm" onClick={() => setEditing(true)}><Edit3 className="h-3 w-3 mr-1" />Edit</Button>
      </div>

      <div className="flex flex-wrap items-center gap-2 rounded-lg border bg-card px-4 py-3">
        <span className="flex items-center gap-1.5 text-sm font-medium"><MapPin className="h-4 w-4 text-primary" />Automatic territories</span>
        {territories.length > 0 ? territories.map((territory: any) => (
          <Badge key={territory.districtId} variant="outline">{territory.districtId?.split('|').join(' · ')}</Badge>
        )) : <span className="text-sm text-muted-foreground">No district or ward configured</span>}
      </div>

      <Modal open={editing} title="Edit ASM" onClose={() => setEditing(false)} className="max-w-3xl">
        <div className="space-y-4">
          <div className="grid grid-cols-1 gap-4 md:grid-cols-2">
            <div><label className="text-sm font-medium block mb-1">Display Name</label><Input value={editForm.displayName} onChange={e => setEditForm({ ...editForm, displayName: e.target.value })} /></div>
            <div>
              <label className="text-sm font-medium block mb-1">Phone</label>
              <PhoneInput
                value={editForm.phone}
                countryCode={editForm.phoneCode}
                onChange={(digits, code) => setEditForm({ ...editForm, phone: digits, phoneCode: code })}
              />
            </div>
            <div><label className="text-sm font-medium block mb-1">Role</label><select className="flex h-10 w-full rounded-md border border-input bg-background px-3 py-2 text-sm" value={editForm.role} onChange={e => setEditForm({ ...editForm, role: e.target.value })}><option value="ASM">ASM</option><option value="C_AND_F">C&amp;F</option><option value="DISTRIBUTOR">Distributor</option><option value="ADMIN">Admin</option><option value="SUPERADMIN">Superadmin</option></select></div>
            <div><label className="text-sm font-medium block mb-1">Approval Status</label><select className="flex h-10 w-full rounded-md border border-input bg-background px-3 py-2 text-sm" value={editForm.approvalStatus} onChange={e => setEditForm({ ...editForm, approvalStatus: e.target.value })}><option value="">Not required</option><option value="PENDING">Pending</option><option value="APPROVED">Approved</option><option value="REJECTED">Rejected</option></select></div>
            <div><label className="text-sm font-medium block mb-1">District ID</label><Input value={editForm.districtId} onChange={e => setEditForm({ ...editForm, districtId: e.target.value })} /></div>
            <div><label className="text-sm font-medium block mb-1">C&amp;F ID</label><Input value={editForm.cfId} onChange={e => setEditForm({ ...editForm, cfId: e.target.value })} /></div>
            <div><label className="text-sm font-medium block mb-1">Avatar URL</label><Input value={editForm.avatarUrl} onChange={e => setEditForm({ ...editForm, avatarUrl: e.target.value })} /></div>
          </div>
          <label className="flex items-center gap-2 text-sm font-medium"><input type="checkbox" checked={editForm.isActive} onChange={e => setEditForm({ ...editForm, isActive: e.target.checked })} className="h-4 w-4" />Active</label>
          <Button onClick={saveManager}>Save Changes</Button>
        </div>
      </Modal>

      <div className="grid grid-cols-2 gap-3 md:grid-cols-4">
        <StatCard title="Territory Distributors" value={stores.length} icon={<Store className="h-4 w-4" />} />
        <StatCard title="Revenue" value={formatCurrency(revenue)} icon={<DollarSign className="h-4 w-4" />} />
        <StatCard title="Completed Orders" value={completedOrders.length} icon={<TrendingUp className="h-4 w-4" />} />
        <StatCard title="Pending Orders" value={pendingOrders.length} icon={<ClipboardList className="h-4 w-4" />} />
      </div>

      {/* Revenue Goal */}
      <Card>
        <CardHeader><CardTitle className="flex items-center gap-2"><Target className="h-4 w-4" />Monthly Revenue Goal</CardTitle></CardHeader>
        <CardContent>
          <form onSubmit={saveTarget} className="space-y-4">
            <div className="grid grid-cols-1 gap-3 sm:grid-cols-[140px_1fr_auto] sm:items-end">
              <div>
                <label className="text-sm font-medium block mb-1">Month</label>
                <input
                  type="month"
                  value={targetMonth}
                  onChange={e => setTargetMonth(e.target.value)}
                  className="flex h-10 w-full rounded-md border border-input bg-background px-3 py-2 text-sm"
                />
              </div>
              <div>
                <label className="text-sm font-medium block mb-1">Target (₹)</label>
                <Input
                  type="number"
                  placeholder="e.g. 500000"
                  value={targetRupees}
                  onChange={e => setTargetRupees(e.target.value)}
                  min={1}
                />
              </div>
              <Button type="submit" disabled={targetSaving}>
                {targetSaving ? <><Loader2 className="mr-2 h-4 w-4 animate-spin" />Saving...</> : 'Save Goal'}
              </Button>
            </div>
            {targetMsg && <p className={`text-sm ${targetMsg.includes('Failed') || targetMsg.includes('valid') ? 'text-destructive' : 'text-green-600'}`}>{targetMsg}</p>}
          </form>

          {targetLoading ? (
            <div className="mt-4 flex items-center gap-2 text-sm text-muted-foreground"><Loader2 className="h-4 w-4 animate-spin" />Loading target...</div>
          ) : currentTarget ? (
            <div className="mt-4 space-y-2">
              <div className="flex items-center justify-between text-sm">
                <span className="text-muted-foreground">Progress</span>
                <span className="font-semibold">{currentTarget.progressPercent}%</span>
              </div>
              <div className="h-4 overflow-hidden rounded-full bg-muted">
                <div
                  className="h-full rounded-full bg-gradient-to-r from-orange-500 to-amber-400 transition-[width] duration-700"
                  style={{ width: `${Math.max(3, currentTarget.progressPercent)}%` }}
                />
              </div>
              <div className="flex justify-between text-xs text-muted-foreground">
                <span>Achieved: {formatCurrency(currentTarget.achievedPaise)}</span>
                <span>Target: {formatCurrency(currentTarget.targetPaise)}</span>
              </div>
              {currentTarget.remainingPaise > 0 && (
                <p className="text-xs text-muted-foreground">Remaining: {formatCurrency(currentTarget.remainingPaise)}</p>
              )}
            </div>
          ) : (
            <p className="mt-4 text-sm text-muted-foreground">No revenue goal set for this month. Set one above.</p>
          )}
        </CardContent>
      </Card>

      {/* Automatic territory distributors */}
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2"><Store className="h-4 w-4" />Territory Distributors ({stores.length})</CardTitle>
          <p className="text-sm text-muted-foreground">Automatically populated from matching ASM districts and wards.</p>
        </CardHeader>
        <CardContent>
          {stores.length === 0 ? (
            <p className="text-sm text-muted-foreground py-4 text-center">No active distributors match this ASM&apos;s district and ward.</p>
          ) : (
            <DataTable data={stores} columns={[
              { key: 'name', header: 'Store' },
              { key: 'city', header: 'City' },
              { key: 'districtId', header: 'Ward', render: (s) => s.districtId?.split('|').at(-1) || '—' },
              { key: 'phone', header: 'Phone' },
              { key: 'approvalStatus', header: 'Status', render: (s) => <Badge variant={s.approvalStatus === 'APPROVED' ? 'success' : 'warning'}>{s.approvalStatus}</Badge> },
            ]} />
          )}
        </CardContent>
      </Card>

      {/* Recent Orders */}
      <Card>
        <CardHeader><CardTitle>Recent Orders ({orders.length})</CardTitle></CardHeader>
        <CardContent>
          {orders.length === 0 ? (
            <p className="text-sm text-muted-foreground py-4 text-center">No orders yet.</p>
          ) : (
            <DataTable data={orders.slice(0, 20)} columns={[
              { key: 'id', header: 'Order ID', render: (o) => <span className="font-mono text-xs">{o.id?.slice(0, 8)}</span> },
              { key: 'status', header: 'Status', render: (o) => <Badge variant={o.status === 'DELIVERED' ? 'success' : o.status === 'CANCELLED' ? 'destructive' : 'warning'}>{o.status}</Badge> },
              { key: 'totalPaise', header: 'Amount', render: (o) => formatCurrency(o.totalPaise) },
              { key: 'paymentMode', header: 'Payment', render: (o) => <Badge variant="outline">{o.paymentMode}</Badge> },
              { key: 'createdAt', header: 'Date', render: (o) => new Date(o.createdAt).toLocaleDateString() },
            ]} />
          )}
        </CardContent>
      </Card>
    </div>
  );
}
