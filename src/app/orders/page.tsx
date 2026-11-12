import type { Metadata } from 'next';
import { MyOrdersList } from '@/components/orders/MyOrdersList';

export const metadata: Metadata = {
  title: 'Your orders · Shelfie',
  robots: { index: false },
};

/** "Your orders": the receipts this browser has opened, read from localStorage. Nothing about the buyer is on the server. */
export default function OrdersPage() {
  return (
    <div className="mx-auto w-full max-w-measure px-gutter pt-8 pb-section lg:pt-16">
      <h1 className="type-display">Your orders</h1>
      <MyOrdersList />
    </div>
  );
}
