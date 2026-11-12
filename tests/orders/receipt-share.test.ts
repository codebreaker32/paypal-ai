// "Keep this receipt": the message and links a buyer sends to themselves.
import { describe, expect, it } from 'vitest';
import { receiptShare } from '@/lib/orders/receipt-share';

describe('receiptShare', () => {
  const share = receiptShare({ appUrl: 'https://shelfie.example/', orderRef: 'ord_abc123', shopName: 'Salt & Crumb', number: 'A-104' });

  it('builds the absolute receipt URL from the configured app URL', () => {
    expect(share.url).toBe('https://shelfie.example/o/ord_abc123');
    expect(share.title).toBe('Your Salt & Crumb order');
  });

  it('says the shop, the order number and the link in plain text', () => {
    expect(share.text).toBe('Your Salt & Crumb order A-104: https://shelfie.example/o/ord_abc123');
    // No emoji or other non-ASCII in the message.
    expect(/^[\x20-\x7e]*$/.test(share.text)).toBe(true);
  });

  it('encodes the text for WhatsApp and SMS so & and : cannot break the link', () => {
    const encoded = 'Your%20Salt%20%26%20Crumb%20order%20A-104%3A%20https%3A%2F%2Fshelfie.example%2Fo%2Ford_abc123';
    expect(share.whatsappHref).toBe(`https://wa.me/?text=${encoded}`);
    expect(share.smsHref).toBe(`sms:?&body=${encoded}`);
    expect(decodeURIComponent(new URL(share.whatsappHref).searchParams.get('text')!)).toBe(share.text);
  });
});
