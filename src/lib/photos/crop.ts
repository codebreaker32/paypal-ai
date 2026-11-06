// "Snap your counter": turns the box Claude gives for an item in a display-case photo into the crop that becomes the
// item's photo. Pure pixel maths: pad the box, grow it to the item photo's 4:3 around its centre, then keep it inside
// the photo (shift first, shrink only if it can't fit).

export interface Box { x0: number; y0: number; x1: number; y1: number }
export interface Rect { left: number; top: number; width: number; height: number }

const PAD = 0.12;
const ASPECT = 4 / 3;

export function cropRect(box: Box, imageWidth: number, imageHeight: number, aspect = ASPECT): Rect {
  const x0 = Math.min(box.x0, box.x1);
  const x1 = Math.max(box.x0, box.x1);
  const y0 = Math.min(box.y0, box.y1);
  const y1 = Math.max(box.y0, box.y1);
  const pad = Math.max(x1 - x0, y1 - y0) * PAD;
  let w = x1 - x0 + 2 * pad;
  let h = y1 - y0 + 2 * pad;
  if (w / h < aspect) w = h * aspect;
  else h = w / aspect;
  // Shrink (keeping the aspect) only when the crop is bigger than the photo.
  const fit = Math.min(1, imageWidth / w, imageHeight / h);
  w = Math.floor(w * fit);
  h = Math.floor(h * fit);
  const cx = (x0 + x1) / 2;
  const cy = (y0 + y1) / 2;
  const left = Math.round(Math.min(Math.max(cx - w / 2, 0), imageWidth - w));
  const top = Math.round(Math.min(Math.max(cy - h / 2, 0), imageHeight - h));
  return { left, top, width: w, height: h };
}
