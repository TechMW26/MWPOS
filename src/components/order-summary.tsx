'use client';

import { useEffect, useState } from 'react';
import Link from 'next/link';
import dynamic from 'next/dynamic';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { formatCurrency } from '@/lib/utils';
import { ArrowLeft, CheckCircle2, Clock, Edit3, History, KeyRound, Loader2, Package, ReceiptText, ShieldCheck, UserRoundCheck, XCircle } from 'lucide-react';

const FirebaseOrderApproval = dynamic(
  () => import('@/components/firebase-order-approval').then((module) => module.FirebaseOrderApproval),
  { ssr: false },
);

interface OrderSummaryProps {
  orderId: string;
  backHref: string;
  role?: string;
}

const statusVariant: Record<string, 'default' | 'success' | 'warning' | 'destructive' | 'outline'> = {
  PENDING_OTP: 'warning',
  OTP_VERIFIED: 'default',
  PENDING_CF_APPROVAL: 'warning',
  CF_APPROVED: 'success',
  CF_REJECTED: 'destructive',
  ALLOCATED: 'default',
  PICKING: 'default',
  PACKED: 'default',
  SHIPPED: 'default',
  DELIVERED: 'success',
  CANCELLED: 'destructive',
};

const statusCopy: Record<string, { label: string; description: string; nextStep: string }> = {
  DRAFT: {
    label: 'Draft',
    description: 'This order has not been submitted yet.',
    nextStep: 'Submit the order to begin processing.',
  },
  PENDING_OTP: {
    label: 'Waiting for distributor OTP approval',
    description: 'The order is placed, but distributor OTP verification is still pending.',
    nextStep: 'Distributor must verify the OTP before C&F approval.',
  },
  OTP_VERIFIED: {
    label: 'OTP approved',
    description: 'Distributor OTP is verified.',
    nextStep: 'The order is ready for C&F approval.',
  },
  PENDING_CF_APPROVAL: {
    label: 'Waiting for C&F approval',
    description: 'The order has been sent to the assigned C&F for approval.',
    nextStep: 'C&F needs to approve or reject this order.',
  },
  CF_APPROVED: {
    label: 'Approved by C&F',
    description: 'The C&F has approved this order.',
    nextStep: 'Inventory will be allocated for picking.',
  },
  ALLOCATED: {
    label: 'Stock allocated',
    description: 'Inventory has been reserved for this order.',
    nextStep: 'Warehouse team can start picking.',
  },
  PICKING: {
    label: 'Picking in progress',
    description: 'Items are being picked from inventory.',
    nextStep: 'Order will move to packing after picking is complete.',
  },
  PACKED: {
    label: 'Packed',
    description: 'The order has been packed.',
    nextStep: 'Order is ready to be shipped.',
  },
  SHIPPED: {
    label: 'Shipped',
    description: 'The order has been shipped.',
    nextStep: 'Mark delivered once the distributor receives it.',
  },
  DELIVERED: {
    label: 'Delivered',
    description: 'The order has been delivered.',
    nextStep: 'No further fulfillment action is required.',
  },
  CF_REJECTED: {
    label: 'Rejected by C&F',
    description: 'The C&F rejected this order.',
    nextStep: 'Review the rejection and create a corrected order if needed.',
  },
  REJECTED: {
    label: 'Rejected',
    description: 'The order was rejected.',
    nextStep: 'Review the reason before placing a new order.',
  },
  CANCELLED: {
    label: 'Cancelled',
    description: 'This order was cancelled.',
    nextStep: 'No further action is required.',
  },
};

const allowedTransitions: Record<string, string[]> = {
  PENDING_OTP: ['CANCELLED'],
  OTP_VERIFIED: ['PENDING_CF_APPROVAL', 'CF_APPROVED', 'CANCELLED'],
  PENDING_CF_APPROVAL: ['CF_APPROVED', 'CF_REJECTED', 'CANCELLED'],
  CF_APPROVED: ['ALLOCATED', 'CANCELLED'],
  ALLOCATED: ['PICKING', 'CANCELLED'],
  PICKING: ['PACKED', 'CANCELLED'],
  PACKED: ['SHIPPED', 'CANCELLED'],
  SHIPPED: ['DELIVERED'],
};

function readable(value: string): string {
  return value.replaceAll('_', ' ').replace(/\b\w/g, (letter) => letter.toUpperCase());
}

export function OrderSummary({ orderId, backHref, role }: OrderSummaryProps) {
  const [order, setOrder] = useState<any>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');

  // Edit quantity state
  const [editingItem, setEditingItem] = useState<any>(null);
  const [editQty, setEditQty] = useState(0);
  const [editReason, setEditReason] = useState('');
  const [savingEdit, setSavingEdit] = useState(false);
  const [editError, setEditError] = useState('');

  // Delete state
  const [deleting, setDeleting] = useState(false);
  const [transitioning, setTransitioning] = useState('');
  const [transitionNotes, setTransitionNotes] = useState('');
  const [transitionError, setTransitionError] = useState('');

  const loadOrder = () => {
    fetch(`/api/orders?orderId=${encodeURIComponent(orderId)}`)
      .then(async (res) => {
        const data = await res.json();
        if (!res.ok) throw new Error(data.message || 'Failed to load order');
        setOrder(data);
      })
      .catch((err) => setError(err instanceof Error ? err.message : 'Failed to load order'))
      .finally(() => setLoading(false));
  };

  useEffect(() => { loadOrder(); }, [orderId]);

  async function handleEditQuantity(e: React.FormEvent) {
    e.preventDefault();
    if (!editReason.trim()) { setEditError('Reason is required'); return; }
    if (editQty < 1) { setEditError('Quantity must be at least 1'); return; }
    setSavingEdit(true); setEditError('');
    try {
      const res = await fetch('/api/orders/edit-item', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ orderId, skuId: editingItem.skuId, newQuantity: editQty, reason: editReason.trim() }),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.message || 'Failed to update quantity');
      setEditingItem(null);
      loadOrder();
    } catch (e: any) {
      setEditError(e.message || 'Failed');
    } finally {
      setSavingEdit(false);
    }
  }

  async function handleDeleteOrder() {
    if (!confirm(`Cancel order #${orderId.slice(0, 8)}? This will be recorded in its history.`)) return;
    setDeleting(true);
    try {
      const res = await fetch('/api/orders/transition', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ orderId, toStatus: 'CANCELLED', idempotencyKey: crypto.randomUUID() }),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.message || 'Failed to cancel order');
      window.location.href = backHref;
    } catch (e: any) {
      alert(e.message || 'Failed to cancel order');
    } finally {
      setDeleting(false);
    }
  }

  async function handleTransition(toStatus: string) {
    setTransitioning(toStatus);
    setTransitionError('');
    try {
      const isCfDecision = order.status === 'PENDING_CF_APPROVAL' && ['CF_APPROVED', 'CF_REJECTED'].includes(toStatus);
      const response = await fetch(isCfDecision ? '/api/orders/cf-approve' : '/api/orders/transition', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(isCfDecision
          ? { orderId, action: toStatus === 'CF_APPROVED' ? 'APPROVE' : 'REJECT', notes: transitionNotes.trim() || undefined }
          : { orderId, toStatus, notes: transitionNotes.trim() || undefined, idempotencyKey: crypto.randomUUID() }),
      });
      const payload = await response.json();
      if (!response.ok) throw new Error(payload.message || 'Unable to update order');
      setTransitionNotes('');
      loadOrder();
    } catch (transitionFailure) {
      setTransitionError(transitionFailure instanceof Error ? transitionFailure.message : 'Unable to update order');
    } finally {
      setTransitioning('');
    }
  }

  const canManageOrder = ['SUPERADMIN', 'ADMIN', 'C_AND_F'].includes(role || '');
  const canVerifyOtp = role === 'DISTRIBUTOR';
  const canEditQuantity = ['SUPERADMIN', 'ADMIN'].includes(role || '')
    ? !['DELIVERED', 'CANCELLED', 'REJECTED', 'CF_REJECTED'].includes(order?.status)
    : role === 'C_AND_F' && ['PENDING_CF_APPROVAL', 'CF_APPROVED', 'ALLOCATED', 'PICKING', 'PACKED'].includes(order?.status);
  const canCancel = canManageOrder && (allowedTransitions[order?.status] || []).includes('CANCELLED');

  if (loading) return <div className="p-6 text-muted-foreground">Loading order summary...</div>;

  if (error || !order) {
    return (
      <Card className="mx-auto max-w-2xl">
        <CardContent className="space-y-4 py-10 text-center">
          <p className="font-medium text-destructive">{error || 'Order not found'}</p>
          <Link href={backHref} className="inline-flex h-10 items-center justify-center rounded-md border border-input bg-background px-4 py-2 text-sm font-medium shadow-sm hover:bg-accent hover:text-accent-foreground">Back to orders</Link>
        </CardContent>
      </Card>
    );
  }

  const items = Object.values(order.items || {}) as any[];
  const currentStatus = statusCopy[order.status] || {
    label: String(order.status || 'Unknown status').replace(/_/g, ' '),
    description: 'Latest order status is shown below.',
    nextStep: 'Check with the assigned team for the next action.',
  };
  const timeline = Array.isArray(order.timeline)
    ? order.timeline
    : Object.entries(order.statusHistory || {}).map(([id, change]: [string, any]) => ({ id, ...change })).sort((a, b) => Date.parse(a.changedAt) - Date.parse(b.changedAt));
  const editTimeline = Array.isArray(order.editTimeline) ? order.editTimeline : [];
  const transitions = canManageOrder ? (allowedTransitions[order.status] || []).filter((item) => item !== 'CANCELLED') : [];

  return (
    <div className="mx-auto max-w-4xl space-y-6">
      <Link href={backHref} className="inline-flex items-center gap-2 rounded-md py-2 text-sm font-medium hover:text-primary">
        <ArrowLeft className="h-4 w-4" />Back to orders
      </Link>

      <Card>
        <CardHeader className="border-b">
          <div className="flex flex-col gap-4 sm:flex-row sm:items-start sm:justify-between">
            <div>
              <CardTitle className="flex items-center gap-2 text-2xl">
                <CheckCircle2 className="h-6 w-6 text-green-600" />
                Order placed
              </CardTitle>
              <p className="mt-1 text-sm text-muted-foreground">Order #{order.id?.slice(0, 8)} · {new Date(order.createdAt).toLocaleString()}</p>
            </div>
            <div className="flex flex-wrap gap-2">
              <Badge variant={statusVariant[order.status] || 'outline'}>{String(order.status || '').replace(/_/g, ' ')}</Badge>
              <Badge variant={order.paymentMode === 'PAY_LATER' ? 'warning' : 'default'}>
                {order.paymentMode === 'PAY_LATER' ? 'Khata / Pay later' : 'Pay upfront'}
              </Badge>
            </div>
          </div>
        </CardHeader>
        <CardContent className="grid gap-6 p-4 lg:grid-cols-[1fr_280px]">
          <div className="space-y-3">
            <p className="flex items-center gap-2 font-semibold"><Package className="h-4 w-4" />Items</p>
            {items.length === 0 ? (
              <p className="rounded-lg border p-4 text-sm text-muted-foreground">No line items found for this order.</p>
            ) : (
              items.map((item) => (
                <div key={item.skuId} className="flex items-center justify-between gap-4 rounded-lg border p-4">
                  <div>
                    <p className="font-medium">{item.productName || item.sku}</p>
                    <p className="text-sm text-muted-foreground">{item.sku} · Qty {item.quantity} · {formatCurrency(item.unitPricePaise)} each</p>
                  </div>
                  <div className="flex items-center gap-3">
                    <p className="font-semibold">{formatCurrency((item.totalPaise || 0) + (item.taxPaise || 0))}</p>
                    {canEditQuantity && (
                      <Button size="sm" variant="outline" className="h-7 px-2" onClick={() => { setEditingItem(item); setEditQty(item.quantity); setEditReason(''); setEditError(''); }}>
                        <Edit3 className="h-3 w-3" />
                      </Button>
                    )}
                  </div>
                </div>
              ))
            )}
          </div>

            <div className="space-y-4">
            <div className="rounded-lg border bg-muted/30 p-4 text-sm">
              <div className="flex items-start gap-3">
                <div className="rounded-full bg-background p-2 text-primary">
                  <Clock className="h-4 w-4" />
                </div>
                <div>
                  <p className="font-semibold">Order status</p>
                  <p className="mt-1 text-base font-bold">{currentStatus.label}</p>
                  <p className="mt-1 text-muted-foreground">{currentStatus.description}</p>
                  <p className="mt-2 text-muted-foreground"><span className="font-medium text-foreground">Next:</span> {currentStatus.nextStep}</p>
                </div>
              </div>
            </div>
            <div className="rounded-lg border p-4">
              <p className="mb-3 flex items-center gap-2 font-semibold"><ReceiptText className="h-4 w-4" />Summary</p>
              <div className="space-y-2 text-sm">
                <div className="flex justify-between"><span>Subtotal</span><span>{formatCurrency(order.subtotalPaise || 0)}</span></div>
                <div className="flex justify-between"><span>Tax</span><span>{formatCurrency(order.taxPaise || 0)}</span></div>
                <div className="flex justify-between"><span>Discount</span><span>{formatCurrency(order.discountPaise || 0)}</span></div>
                <div className="flex justify-between border-t pt-2 text-base font-bold"><span>Total</span><span>{formatCurrency(order.totalPaise || 0)}</span></div>
              </div>
            </div>
            <div className="rounded-lg border bg-muted/30 p-4 text-sm">
              <p className="font-medium">Payment status</p>
              <p className="mt-1 text-muted-foreground">{String(order.paymentStatus || '').replace(/_/g, ' ')}</p>
              {order.paymentProofUrl && (
                <p className="mt-2">
                  <a href={order.paymentProofUrl} target="_blank" rel="noreferrer" className="font-medium text-primary hover:underline">
                    View {order.paymentProofType === 'CHEQUE' ? 'cheque' : 'payment'} proof{order.paymentProofFileName ? `: ${order.paymentProofFileName}` : ''}
                  </a>
                </p>
              )}
              {order.paymentReference && <p className="mt-2 text-muted-foreground">Reference: {order.paymentReference}</p>}
              {order.paymentMode === 'PAY_LATER' && <p className="mt-2 text-muted-foreground">{order.asmId && order.otpStatus !== 'VERIFIED' ? 'Khata will be updated only after distributor OTP approval.' : 'This order has been added to khata.'}</p>}
              {order.otpStatus === 'PENDING' && <p className="mt-2 text-yellow-700">Distributor OTP verification is still pending.</p>}
              {order.otpStatus === 'EXPIRED' && <p className="mt-2 text-red-700">The OTP expired. Send a new one before approval.</p>}
              {order.otpStatus === 'FAILED' && <p className="mt-2 text-red-700">OTP attempts were exhausted. Send a new OTP.</p>}
              {order.otpStatus === 'VERIFIED' && <p className="mt-2 text-green-700">✓ Distributor OTP verified.</p>}
            </div>

            {/* OTP Verification Input */}
            {order.status === 'PENDING_OTP' && (canVerifyOtp
              ? <FirebaseOrderApproval orderId={orderId} phone={order.context?.distributor?.phone || null} onVerified={loadOrder} />
              : <div className="rounded-lg border border-yellow-300 bg-yellow-50 p-4"><p className="flex items-center gap-2 text-sm font-semibold text-yellow-800"><KeyRound className="h-4 w-4" />Distributor approval required</p><p className="mt-2 text-sm text-yellow-800">The distributor has been notified through Firebase. Only their linked account can request and enter the Firebase OTP.</p></div>)}
          </div>
        </CardContent>
      </Card>

      <div className="grid gap-4 lg:grid-cols-2">
        <Card>
          <CardHeader><CardTitle className="flex items-center gap-2 text-lg"><UserRoundCheck className="h-5 w-5" />Order attribution</CardTitle></CardHeader>
          <CardContent className="space-y-3 text-sm">
            <div className="flex justify-between gap-4"><span className="text-muted-foreground">Distributor</span><strong className="text-right">{order.context?.distributor?.name || order.distributorId}</strong></div>
            <div className="flex justify-between gap-4"><span className="text-muted-foreground">Placed by</span><strong className="text-right">{order.context?.placedBy?.name || order.placedByUid}<span className="block text-xs font-normal text-muted-foreground">{readable(order.context?.placedBy?.role || 'USER')}</span></strong></div>
            <div className="flex justify-between gap-4"><span className="text-muted-foreground">Responsible ASM</span><strong className="text-right">{order.context?.asm?.name || (order.asmId ? order.asmId : 'Direct distributor order')}</strong></div>
            <div className="flex justify-between gap-4"><span className="text-muted-foreground">Assigned C&amp;F</span><strong className="text-right">{order.context?.cf?.name || 'Not assigned'}</strong></div>
            <div className="flex justify-between gap-4"><span className="text-muted-foreground">C&amp;F approval</span><Badge variant={order.cfApprovalStatus === 'APPROVED' ? 'success' : order.cfApprovalStatus === 'REJECTED' ? 'destructive' : 'warning'}>{readable(order.cfApprovalStatus || 'NOT REQUIRED')}</Badge></div>
          </CardContent>
        </Card>

        <Card>
          <CardHeader><CardTitle className="flex items-center gap-2 text-lg"><ShieldCheck className="h-5 w-5" />Approval history</CardTitle></CardHeader>
          <CardContent className="space-y-3">
            {timeline.filter((event: any) => ['PENDING_OTP', 'OTP_VERIFIED', 'PENDING_CF_APPROVAL', 'CF_APPROVED', 'CF_REJECTED', 'REJECTED'].includes(event.to)).length === 0 ? (
              <p className="text-sm text-muted-foreground">No approval events recorded yet.</p>
            ) : timeline.filter((event: any) => ['PENDING_OTP', 'OTP_VERIFIED', 'PENDING_CF_APPROVAL', 'CF_APPROVED', 'CF_REJECTED', 'REJECTED'].includes(event.to)).map((event: any) => (
              <div key={event.id} className="flex items-start gap-3 rounded-lg border p-3 text-sm">
                {['CF_REJECTED', 'REJECTED'].includes(event.to) ? <XCircle className="mt-0.5 h-4 w-4 text-destructive" /> : <CheckCircle2 className="mt-0.5 h-4 w-4 text-primary" />}
                <div><p className="font-medium">{readable(event.to)}</p><p className="text-muted-foreground">{event.actorName || event.changedBy} · {new Date(event.changedAt).toLocaleString('en-IN')}</p>{event.notes && <p className="mt-1 text-muted-foreground">{event.notes}</p>}</div>
              </div>
            ))}
          </CardContent>
        </Card>
      </div>

      <Card>
        <CardHeader><CardTitle className="flex items-center gap-2 text-lg"><History className="h-5 w-5" />Complete order timeline</CardTitle></CardHeader>
        <CardContent>
          {timeline.length === 0 ? <p className="text-sm text-muted-foreground">No timeline events recorded.</p> : (
            <ol>
              {timeline.map((event: any, index: number) => (
                <li key={event.id} className="relative grid grid-cols-[1.25rem_1fr] gap-3 pb-5 last:pb-0">
                  {index < timeline.length - 1 && <span className="absolute left-[0.59rem] top-4 h-full w-px bg-border" />}
                  <span className="relative mt-1 h-5 w-5 rounded-full border-4 border-card bg-primary" />
                  <div><div className="flex flex-wrap items-center gap-2"><p className="font-medium">{readable(event.to)}</p>{event.from && <span className="text-xs text-muted-foreground">from {readable(event.from)}</span>}</div><p className="text-sm text-muted-foreground">{event.actorName || event.changedBy}{event.actorRole ? ` (${readable(event.actorRole)})` : ''} · {new Date(event.changedAt).toLocaleString('en-IN')}</p>{event.notes && <p className="mt-1 text-sm">{event.notes}</p>}</div>
                </li>
              ))}
            </ol>
          )}
          {editTimeline.length > 0 && <div className="mt-6 border-t pt-4"><p className="mb-3 font-semibold">Item edit history</p><div className="space-y-3">{editTimeline.map((edit: any) => <div key={edit.id} className="rounded-lg border p-3 text-sm"><p className="font-medium">{edit.actorName} changed {edit.skuId} from {edit.oldQuantity} to {edit.newQuantity}</p><p className="text-muted-foreground">{new Date(edit.editedAt).toLocaleString('en-IN')} · {edit.reason}</p><p className="text-muted-foreground">Order total: {formatCurrency(edit.oldTotal || 0)} → {formatCurrency(edit.newTotal || 0)}</p></div>)}</div></div>}
        </CardContent>
      </Card>

      {/* Edit Quantity Modal */}
      {editingItem && (
        <Card className="mx-auto max-w-4xl border-yellow-300 bg-yellow-50">
          <CardHeader>
            <CardTitle className="text-lg">Edit Quantity — {editingItem.productName || editingItem.sku}</CardTitle>
          </CardHeader>
          <CardContent>
            <form onSubmit={handleEditQuantity} className="space-y-4">
              <div>
                <label className="text-sm font-medium block mb-1">New Quantity</label>
                <Input type="number" min={1} value={editQty} onChange={e => setEditQty(Number(e.target.value))} required />
                <p className="text-xs text-muted-foreground mt-1">Current: {editingItem.quantity} × {formatCurrency(editingItem.unitPricePaise)} = {formatCurrency(editingItem.totalPaise || editingItem.unitPricePaise * editingItem.quantity)}</p>
              </div>
              <div>
                <label className="text-sm font-medium block mb-1">Reason for change *</label>
                <Input placeholder="e.g. Stock shortage, customer request, quality issue..." value={editReason} onChange={e => setEditReason(e.target.value)} required />
              </div>
              {editError && <p className="text-sm text-red-600">{editError}</p>}
              <div className="flex gap-2">
                <Button type="submit" disabled={savingEdit}>
                  {savingEdit ? <Loader2 className="h-4 w-4 animate-spin mr-1" /> : null}
                  Save Changes
                </Button>
                <Button variant="outline" type="button" onClick={() => setEditingItem(null)}>Cancel</Button>
              </div>
            </form>
          </CardContent>
        </Card>
      )}

      {/* Role-scoped workflow actions */}
      {(canEditQuantity || canCancel || transitions.length > 0) && (
        <Card className="mx-auto max-w-4xl">
          <CardHeader><CardTitle className="text-lg">Workflow actions</CardTitle></CardHeader>
          <CardContent className="space-y-3">
            {transitions.length > 0 && <Input value={transitionNotes} onChange={(event) => setTransitionNotes(event.target.value)} placeholder="Optional approval or transition note" aria-label="Workflow action note" />}
            <div className="flex flex-wrap gap-3">
            {transitions.map((nextStatus) => (
              <Button key={nextStatus} variant={nextStatus.includes('REJECTED') ? 'destructive' : 'default'} onClick={() => handleTransition(nextStatus)} disabled={Boolean(transitioning)}>
                {transitioning === nextStatus && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}{readable(nextStatus)}
              </Button>
            ))}
            {canCancel && (
              <Button variant="destructive" onClick={handleDeleteOrder} disabled={deleting}>
                {deleting ? <Loader2 className="h-4 w-4 animate-spin mr-1" /> : <XCircle className="h-4 w-4 mr-1" />}
                Cancel order
              </Button>
            )}
            </div>
            {transitionError && <p className="text-sm text-destructive">{transitionError}</p>}
          </CardContent>
        </Card>
      )}
    </div>
  );
}
