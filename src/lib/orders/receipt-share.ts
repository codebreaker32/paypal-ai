// "Keep this receipt": the text and links a buyer uses to send the receipt link to themselves. Built in the browser,
// sent by the buyer's own apps; Shelfie collects no phone number and sends nothing.

export interface ReceiptShareInput {
  appUrl: string;
  orderRef: string;
  shopName: string;
  number: string;
}

export interface ReceiptShare {
  url: string;
  title: string;
  text: string;
  whatsappHref: string;
  smsHref: string;
}

export function receiptShare({ appUrl, orderRef, shopName, number }: ReceiptShareInput): ReceiptShare {
  const url = `${appUrl.replace(/\/+$/, '')}/o/${encodeURIComponent(orderRef)}`;
  const text = `Your ${shopName} order ${number}: ${url}`;
  const encoded = encodeURIComponent(text);
  return {
    url,
    title: `Your ${shopName} order`,
    text,
    whatsappHref: `https://wa.me/?text=${encoded}`,
    smsHref: `sms:?&body=${encoded}`,
  };
}
