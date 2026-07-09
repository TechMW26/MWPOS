import { OrderSummary } from '@/components/order-summary';

export default async function CfOrderSummaryPage({ params }: { params: Promise<{ orderId: string }> }) {
  const { orderId } = await params;
  return <OrderSummary orderId={orderId} backHref="/cf/orders" role="C_AND_F" />;
}
