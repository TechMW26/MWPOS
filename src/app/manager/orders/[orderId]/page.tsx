import { OrderSummary } from '@/components/order-summary';

export default async function ManagerOrderSummaryPage({ params }: { params: Promise<{ orderId: string }> }) {
  const { orderId } = await params;
  return <OrderSummary orderId={orderId} backHref="/manager/orders" />;
}
