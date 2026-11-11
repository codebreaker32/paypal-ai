'use client';

import { ChatA } from './ChatA';
import { ChatB } from './ChatB';
import { ChatC } from './ChatC';
import type { ChatUi, ChatVariantProps } from './types';
import './chatui.css';

/** The `?chatui=` mockup asked for. Each draws the whole inside of the panel (desktop) or sheet (phones). */
export function ChatVariant({ chatui, ...props }: ChatVariantProps & { chatui: ChatUi }) {
  if (chatui === 'a') return <ChatA {...props} />;
  if (chatui === 'b') return <ChatB {...props} />;
  return <ChatC {...props} />;
}
