import { OrderSummary } from '@/components/order-summary';

export default async function StorefrontOrderSummaryPage({ params }: { params: Promise<{ orderId: string }> }) {
  const { orderId } = await params;
  return <OrderSummary orderId={orderId} backHref="/storefront/orders" role="C_AND_F" />;
}
