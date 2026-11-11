'use client';

import type { ChatVariantProps } from './types';

/** Mockup C (`/?chatui=c`): placeholder until built. */
export function ChatC(props: ChatVariantProps) {
  return (
    <div data-chatui-root="c" className="h-full p-4">
      <h2 ref={props.titleRef} id={props.titleId} tabIndex={-1}>Shelfie assistant</h2>
    </div>
  );
}
