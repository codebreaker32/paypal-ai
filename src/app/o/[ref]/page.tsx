import type { Metadata } from 'next';
import { notFound } from 'next/navigation';
import { CONSOLE_AGENT_NAME } from '@/lib/agent/buyer-console';
import { getDb } from '@/lib/db';
import * as ordersRepo from '@/lib/db/repos/orders';
import * as shopsRepo from '@/lib/db/repos/shops';
import { Receipt } from './Receipt';
import { receiptView } from '@/lib/orders/receipt';

export const metadata: Metadata = {
  title: 'Your order · Shelfie',
  robots: { index: false },
};

/** The buyer's receipt: what happened to the order, read from SQLite and refreshed while PayPal is still deciding. */
export default async function ReceiptPage({ params }: PageProps<'/o/[ref]'>) {
  const { ref } = await params;
  const db = getDb();
  const order = receiptView(db, ref);
  if (!order) notFound();
  const row = ordersRepo.byId(db, ref)!;
  const shop = shopsRepo.byId(db, row.shopId)!;
  const tracking = ordersRepo.trackers(db, ref).at(-1) ?? null;

  return (
    <div className="mx-auto w-full max-w-page px-gutter pt-8 pb-section lg:pt-16">
      <Receipt
        orderRef={ref}
        initial={order}
        pickupNotes={shop.pickupNotes}
        fromAssistant={row.agentName === CONSOLE_AGENT_NAME}
        tracking={tracking ? { carrier: tracking.carrier, number: tracking.trackingNumber } : null}
      />
    </div>
  );
}
