import { OrderSummary } from '@/components/order-summary';

export default async function AdminOrderSummaryPage({ params }: { params: Promise<{ orderId: string }> }) {
  const { orderId } = await params;
  return <OrderSummary orderId={orderId} backHref="/admin/orders" role="ADMIN" />;
}
