'use client';

import { useEffect, type RefObject } from 'react';

export interface KeyboardViewportInput {
  innerHeight: number;
  height: number;
  offsetTop: number;
  scale: number;
}

/**
 * The visible box while an on-screen keyboard covers the page, or null when there is nothing to correct: the page is
 * pinch-zoomed, or the gap is too small to be a keyboard (browser bars). Browsers that resize the layout for the
 * keyboard (`interactive-widget=resizes-content`) leave no gap, so they get null too.
 */
export function keyboardViewport({ innerHeight, height, offsetTop, scale }: KeyboardViewportInput): { h: number; y: number } | null {
  if (scale > 1.01 || innerHeight - height < 120) return null;
  return { h: height, y: offsetTop };
}

/** Keeps an open modal assistant on top of the keyboard, through `--assistant-vh` and `--assistant-vy` on the dialog. */
export function useKeyboardViewport(dialogRef: RefObject<HTMLDialogElement | null>, open: boolean): void {
  useEffect(() => {
    const dialog = dialogRef.current;
    const vv = window.visualViewport;
    if (!open || !dialog || !vv) return;
    const clear = () => {
      dialog.style.removeProperty('--assistant-vh');
      dialog.style.removeProperty('--assistant-vy');
    };
    const apply = () => {
      const box = keyboardViewport({ innerHeight: window.innerHeight, height: vv.height, offsetTop: vv.offsetTop, scale: vv.scale });
      if (!box) return clear();
      dialog.style.setProperty('--assistant-vh', `${box.h}px`);
      dialog.style.setProperty('--assistant-vy', `${box.y}px`);
    };
    let frame = 0;
    const schedule = () => {
      if (frame) return;
      frame = requestAnimationFrame(() => {
        frame = 0;
        apply();
      });
    };
    apply();
    vv.addEventListener('resize', schedule);
    vv.addEventListener('scroll', schedule);
    return () => {
      vv.removeEventListener('resize', schedule);
      vv.removeEventListener('scroll', schedule);
      cancelAnimationFrame(frame);
      clear();
    };
  }, [dialogRef, open]);
}
