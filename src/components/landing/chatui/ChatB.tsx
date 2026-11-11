'use client';

import type { ChatVariantProps } from './types';

/** Mockup B (`/?chatui=b`): placeholder until built. */
export function ChatB(props: ChatVariantProps) {
  return (
    <div data-chatui-root="b" className="h-full p-4">
      <h2 ref={props.titleRef} id={props.titleId} tabIndex={-1}>Shelfie assistant</h2>
    </div>
  );
}
