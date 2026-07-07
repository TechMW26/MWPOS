import { OrderSummary } from '@/components/order-summary';

export default async function AsmOrderSummaryPage({ params }: { params: Promise<{ orderId: string }> }) {
  const { orderId } = await params;
  return <OrderSummary orderId={orderId} backHref="/asm/orders" />;
}
