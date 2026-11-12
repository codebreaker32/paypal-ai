import type { ReactNode, RefObject } from 'react';
import type { BuyerConsoleApi } from '@/components/shop/BuyerConsole';

/**
 * One listed menu item as the home chat shows it on a card: its real name, lowest listed price and picture
 * (`src/lib/library/picture.ts`: the seller's own photo, else an example photo; null leaves the card without a photo).
 */
export interface ChatMenuItem {
  id: string;
  name: string;
  /** The lowest listed price, in cents. */
  priceCents: number;
  /** Site-relative picture, or null for none. */
  photoUrl: string | null;
  /** The picture is an example from the library, not the seller's own photo: the card says so. */
  example: boolean;
}

/** What the home chat's panel and sheet get from HomeChat. */
export interface HomeChatPanelProps {
  api: BuyerConsoleApi;
  shopName: string;
  starters: string[];
  /** The shop's cover photo (site-relative) or null. */
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
