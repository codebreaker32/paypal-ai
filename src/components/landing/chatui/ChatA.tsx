'use client';

import type { ChatVariantProps } from './types';

/** Mockup A (`/?chatui=a`): placeholder until built. */
export function ChatA(props: ChatVariantProps) {
  return (
    <div data-chatui-root="a" className="h-full p-4">
      <h2 ref={props.titleRef} id={props.titleId} tabIndex={-1}>Shelfie assistant</h2>
    </div>
  );
}
