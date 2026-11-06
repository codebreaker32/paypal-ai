// QR codes for the counter card, made on our own server with the `qrcode` package (never a third-party service).
import QRCode from 'qrcode';

/** An SVG QR code of `text`: a viewBox and no fixed size, so it fills whatever box holds it. Same text, same SVG. */
export function qrSvg(text: string): Promise<string> {
  return QRCode.toString(text, { type: 'svg', margin: 1, errorCorrectionLevel: 'M' });
}
