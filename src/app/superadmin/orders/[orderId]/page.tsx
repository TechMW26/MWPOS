import { OrderSummary } from '@/components/order-summary';

export default async function SuperadminOrderSummaryPage({ params }: { params: Promise<{ orderId: string }> }) {
  const { orderId } = await params;
  return <OrderSummary orderId={orderId} backHref="/superadmin/orders" role="SUPERADMIN" />;
}
