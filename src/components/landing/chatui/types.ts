import type { ReactNode, RefObject } from 'react';
import type { BuyerConsoleApi } from '@/components/shop/BuyerConsole';

/** The home chat's three mockups, chosen with `/?chatui=a|b|c` (docs/preview/chatui/README.md). Without one, today's design. */
export type ChatUi = 'a' | 'b' | 'c';
export const CHAT_UIS: readonly ChatUi[] = ['a', 'b', 'c'];
export const parseChatUi = (v: unknown): ChatUi | null => (typeof v === 'string' && (CHAT_UIS as readonly string[]).includes(v) ? (v as ChatUi) : null);

/** One menu item as the shop-aware mockup shows it: real name, price and the seller's own photo (or none). */
export interface ChatMenuItem {
  id: string;
  name: string;
  section: string | null;
  description: string | null;
  /** The lowest listed price, in cents. */
  priceCents: number;
  /** Site-relative; null when the seller has no photo of it. */
  photoUrl: string | null;
}

/** What a mockup gets from HomeChat. Each one draws its own header, log and footer around the same console. */
export interface ChatVariantProps {
  api: BuyerConsoleApi;
  shopName: string;
  shopSlug: string;
  starters: string[];
  /** The example shop's cover photo (site-relative) or null. */
  cover: string | null;
  menu: ChatMenuItem[];
  titleId: string;
  titleRef: RefObject<HTMLHeadingElement | null>;
  inputRef: RefObject<HTMLTextAreaElement | null>;
  onClose: () => void;
  /** null while hydrating; false on phones and tablets (a bottom sheet). */
  isDesktop: boolean | null;
  greeting: ReactNode;
}
