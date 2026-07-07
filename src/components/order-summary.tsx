'use client';

import { useEffect, useState } from 'react';
import Link from 'next/link';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { formatCurrency } from '@/lib/utils';
import { ArrowLeft, CheckCircle2, Clock, KeyRound, Loader2, Package, ReceiptText } from 'lucide-react';

interface OrderSummaryProps {
  orderId: string;
  backHref: string;
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

export function OrderSummary({ orderId, backHref }: OrderSummaryProps) {
  const [order, setOrder] = useState<any>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [otpCode, setOtpCode] = useState('');
  const [verifying, setVerifying] = useState(false);
  const [otpError, setOtpError] = useState('');
  const [otpSuccess, setOtpSuccess] = useState(false);

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

  async function handleVerifyOtp() {
    if (!otpCode || otpCode.length !== 6) {
      setOtpError('Please enter the 6-digit OTP');
      return;
    }
    setVerifying(true);
    setOtpError('');
    try {
      const res = await fetch('/api/orders/otp-verify', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ orderId, otpCode }),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.message || 'OTP verification failed');
      setOtpSuccess(true);
      loadOrder();
    } catch (e: any) {
      setOtpError(e.message || 'Verification failed');
    } finally {
      setVerifying(false);
    }
  }

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
                  <p className="font-semibold">{formatCurrency((item.totalPaise || 0) + (item.taxPaise || 0))}</p>
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
              {order.paymentMode === 'PAY_LATER' && <p className="mt-2 text-muted-foreground">This order has been added to khata immediately.</p>}
              {order.otpStatus === 'PENDING' && <p className="mt-2 text-yellow-700">Distributor OTP verification is still pending.</p>}
              {order.otpStatus === 'VERIFIED' && <p className="mt-2 text-green-700">✓ Distributor OTP verified.</p>}
            </div>

            {/* OTP Verification Input */}
            {order.otpStatus === 'PENDING' && !otpSuccess && (
              <div className="rounded-lg border border-yellow-300 bg-yellow-50 p-4">
                <p className="flex items-center gap-2 text-sm font-semibold text-yellow-800">
                  <KeyRound className="h-4 w-4" />
                  Verify Distributor OTP
                </p>
                <p className="mt-1 text-xs text-yellow-700">
                  Enter the 6-digit OTP sent to the distributor
                  {order.otpDestination ? ` (${order.otpChannel}: ${order.otpDestination})` : ''}.
                  {order.otpExpiresAt && ` Expires: ${new Date(order.otpExpiresAt).toLocaleString()}.`}
                </p>
                <div className="mt-3 flex gap-2">
                  <Input
                    placeholder="Enter 6-digit OTP"
                    value={otpCode}
                    onChange={(e) => setOtpCode(e.target.value.replace(/\D/g, '').slice(0, 6))}
                    maxLength={6}
                    className="font-mono text-lg tracking-widest"
                    disabled={verifying}
                  />
                  <Button onClick={handleVerifyOtp} disabled={verifying || otpCode.length !== 6}>
                    {verifying ? <Loader2 className="h-4 w-4 animate-spin mr-1" /> : <KeyRound className="h-4 w-4 mr-1" />}
                    Verify
                  </Button>
                </div>
                {otpError && <p className="mt-2 text-sm text-red-600">{otpError}</p>}
              </div>
            )}
            {otpSuccess && (
              <div className="rounded-lg border border-green-300 bg-green-50 p-4">
                <p className="flex items-center gap-2 text-sm font-semibold text-green-800">
                  <CheckCircle2 className="h-4 w-4" />
                  OTP Verified Successfully
                </p>
                <p className="mt-1 text-xs text-green-700">The order is now moving to the next stage.</p>
              </div>
            )}
          </div>
        </CardContent>
      </Card>
    </div>
  );
}
