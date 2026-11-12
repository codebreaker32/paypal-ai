import fs from 'node:fs';
import path from 'node:path';
import { createElement, type ComponentProps, type ReactElement } from 'react';
import { renderToStaticMarkup } from 'react-dom/server';
import { describe, expect, it, vi } from 'vitest';
import { Copy, Trash2 } from 'lucide-react';
import { Pressable } from '@/components/motion/pressable';
import { CopyButton, copyAndReport } from '@/components/ui/copy-button';
import { IconButton } from '@/components/ui/icon-button';
import { PayPalLink, leavesThisPage } from '@/components/ui/paypal-link';
import { TextLink } from '@/components/ui/text-link';
import { ToastProvider } from '@/components/ui/toast';
import { Switch } from '@/components/dashboard/Switch';
import { CopyButton as DashboardCopyButton } from '@/components/dashboard/CopyButton';

const root = path.resolve(import.meta.dirname, '../..');
const css = fs.readFileSync(path.join(root, 'src/app/globals.css'), 'utf8');
const source = (file: string) => fs.readFileSync(path.join(root, file), 'utf8');

const layers = (html: string) => [...html.matchAll(/data-layer="(\w+)"/g)].map((m) => m[1]);
const opening = (html: string, tag = 'button') => new RegExp(`<${tag}[^>]*>`).exec(html)![0];

describe('IconButton', () => {
  const render = (props: Partial<ComponentProps<typeof IconButton>> = {}) =>
    renderToStaticMarkup(createElement(IconButton, { icon: Trash2, label: 'Remove photo', ...props }));

  it('is named by its label and presses with the icon scale', () => {
    const tag = opening(render());
    expect(tag).toContain('aria-label="Remove photo"');
    expect(tag).toContain('press-icon');
    expect(tag).toContain('hover:bg-surface-sunken');
  });

  it('spinner replaces the icon while loading, in the same layers', () => {
    expect(layers(render())).toEqual(['idle', 'loading', 'success']);
    expect(layers(render({ status: 'loading' }))).toEqual(['idle', 'loading', 'success']);
    const html = render({ status: 'loading' });
    expect(html).toContain('animate-spin');
    expect(opening(html)).toContain('aria-busy="true"');
    expect(opening(html)).toContain('aria-disabled="true"');
    expect(opening(html)).not.toMatch(/\bdisabled=""/);
  });

  it('keeps native disabled for an unavailable button', () => {
    expect(opening(render({ disabled: true }))).toMatch(/\bdisabled=""/);
  });

  it('guards clicks while busy', () => {
    const spy = vi.fn();
    const event = { preventDefault: vi.fn(), stopPropagation: vi.fn() };
    const el = IconButton({ icon: Copy, label: 'x', status: 'loading', onClick: spy }) as ReactElement<{ onClick: (e: unknown) => void }>;
    el.props.onClick(event);
    expect(spy).not.toHaveBeenCalled();
    expect(event.preventDefault).toHaveBeenCalled();
  });
});

describe('TextLink', () => {
  it('is a real link with press-text and a darkening underline', () => {
    const html = renderToStaticMarkup(createElement(TextLink, { href: '/s/x' }, 'See it on your shop'));
    expect(html).toMatch(/^<a /);
    expect(html).toContain('href="/s/x"');
    expect(html).toContain('press-text');
    expect(html).toContain('hover:decoration-ink');
  });
});

describe('PayPalLink', () => {
  const render = (props: Partial<ComponentProps<typeof PayPalLink>> = {}) =>
    renderToStaticMarkup(createElement(PayPalLink, { href: 'https://www.sandbox.paypal.com/a', ...props } as ComponentProps<typeof PayPalLink>, 'Approve $4.00 on PayPal'));

  it('is a real anchor with no provider, styled and pressed as a PayPal button', () => {
    const html = render({ fullWidth: true, size: 'lg' });
    expect(opening(html, 'a')).toContain('href="https://www.sandbox.paypal.com/a"');
    expect(opening(html, 'a')).toContain('bg-(--button-paypal-bg)');
    expect(opening(html, 'a')).toContain('[--press-local:var(--press-scale-wide)]');
    expect(html).toContain('Approve $4.00 on PayPal');
  });

  it('holds the opening label in a hidden layer so its width never changes', () => {
    const html = render();
    expect(layers(html)).toEqual(['idle', 'loading']);
    expect(/<span data-layer="loading" class="([^"]*)"/.exec(html)![1]).toContain('invisible');
    expect(html).toContain('Opening PayPal…');
  });

  it('only flips the label for a click that leaves this page', () => {
    const plain = { metaKey: false, ctrlKey: false, shiftKey: false, altKey: false };
    expect(leavesThisPage(plain)).toBe(true);
    expect(leavesThisPage({ ...plain, ctrlKey: true })).toBe(false);
    expect(leavesThisPage({ ...plain, metaKey: true })).toBe(false);
    expect(leavesThisPage({ ...plain, shiftKey: true })).toBe(false);
    expect(leavesThisPage(plain, '_blank')).toBe(false);
    expect(leavesThisPage(plain, '_self')).toBe(true);
  });
});

describe('copyAndReport', () => {
  it('reports success quietly: no toast', async () => {
    const toast = vi.fn();
    expect(await copyAndReport('abc', toast, async () => {})).toBe(true);
    expect(toast).not.toHaveBeenCalled();
  });

  it('a denied clipboard shows the failure toast', async () => {
    const toast = vi.fn();
    const write = vi.fn().mockRejectedValue(new Error('denied'));
    expect(await copyAndReport('abc', toast, write)).toBe(false);
    expect(write).toHaveBeenCalledWith('abc');
    expect(toast).toHaveBeenCalledTimes(1);
    expect(toast).toHaveBeenCalledWith({ title: 'Couldn’t copy', description: 'Select the text and copy it yourself.', tone: 'danger' });
  });
});

describe('CopyButton', () => {
  const render = (props: Partial<ComponentProps<typeof CopyButton>> = {}) =>
    renderToStaticMarkup(createElement(ToastProvider, null, createElement(CopyButton, { text: 'x', what: 'Shop link', ...props })));

  it('has an empty sr-only status region ready to announce', () => {
    expect(render()).toMatch(/<span role="status" class="sr-only"><\/span>/);
  });

  it('names the action until copied, and stays usable (idle, not aria-disabled)', () => {
    const tag = opening(render());
    expect(tag).toContain('aria-label="Copy Shop link"');
    expect(tag).toContain('data-status="idle"');
    expect(tag).not.toContain('aria-disabled="true"');
  });

  it('holds Copied in its own layer so the width never changes', () => {
    const html = render({ label: 'Copy agent door link' });
    expect(html).toContain('Copy agent door link');
    expect(html).toContain('Copied');
    expect(html).toMatch(/<span class="[^"]*invisible[^"]*">(?:(?!<\/span>).)*Copied<\/span>/);
  });

  it('a visible label is the accessible name; a custom name wins', () => {
    expect(opening(render({ label: 'Copy link' }))).not.toContain('aria-label');
    expect(opening(render({ ariaLabel: 'Copy the agent door link' }))).toContain('aria-label="Copy the agent door link"');
  });

  it('icon-only renders an IconButton with the copy name', () => {
    const tag = opening(render({ iconOnly: true, what: 'tracking number' }));
    expect(tag).toContain('aria-label="Copy tracking number"');
    expect(tag).toContain('press-icon');
  });

  it('the dashboard path re-exports the shared button', () => {
    expect(DashboardCopyButton).toBe(CopyButton);
  });

  it('the old copies are gone', () => {
    expect(source('src/components/shop/AgentDoor.tsx')).not.toMatch(/function CopyButton|clipboard/);
    expect(source('src/components/setup/LiveStep.tsx')).not.toMatch(/function copyText|clipboard/);
  });
});

describe('Switch', () => {
  const render = (props: Partial<ComponentProps<typeof Switch>> = {}) =>
    renderToStaticMarkup(createElement(Switch, { checked: false, onChange: () => {}, label: 'Pause agent orders', ...props }));

  it('never dims and never sets native disabled; busy and disabled use aria-disabled', () => {
    for (const props of [{ busy: true }, { disabled: true }]) {
      const html = render(props);
      const tag = opening(html);
      expect(tag).toContain('aria-disabled="true"');
      expect(tag).not.toMatch(/\bdisabled=""/);
      expect(html).not.toContain('opacity-60');
    }
    expect(opening(render({ busy: true }))).toContain('aria-busy="true"');
    expect(opening(render())).not.toContain('aria-disabled');
  });

  it('the spinner is always there but only shows after 300 ms of being busy', () => {
    expect(render()).toContain('opacity-0');
    const busy = render({ busy: true });
    expect(busy).toContain('delay-300');
    expect(busy).toContain('animate-spin');
    expect(render()).not.toContain('animate-spin');
  });

  it('the thumb flexes toward its travel: origin-left when off, origin-right when on', () => {
    expect(render()).toContain('origin-left');
    expect(render({ checked: true })).toContain('origin-right');
    expect(render()).toContain('data-thumb');
  });

  it('marks a failure with data-nope and the shake', () => {
    expect(opening(render({ failed: true }))).toContain('data-nope');
    expect(render({ failed: true })).toContain('animate-nope');
    expect(opening(render())).not.toContain('data-nope');
    expect(render()).not.toContain('animate-nope');
  });

  it('has press-switch so the fallback does not dim the whole switch', () => {
    expect(opening(render())).toContain('press-switch');
  });

  it('press-switch flexes the thumb, and the flex stops under reduced motion', () => {
    expect(css).toMatch(/@utility press-switch/);
    expect(css).toMatch(/\[data-pressed\][^{]*\[data-thumb\]\s*\{[^}]*scale:\s*var\(--press-flex\)\s+1/);
    expect(css).toMatch(/--press-flex:\s*1\.18/);
    const reduced = /@media \(prefers-reduced-motion: reduce\) \{[\s\S]*?\n\}/.exec(css)![0];
    expect(reduced).toMatch(/--press-flex:\s*1;/);
  });
});

describe('Pressable', () => {
  it('uses press-surface and no active: classes', () => {
    const html = renderToStaticMarkup(createElement(Pressable, { as: 'article' } as ComponentProps<typeof Pressable>, 'x'));
    expect(html).toContain('press-surface');
    expect(html).not.toContain('active:');
  });
});

describe('where toasts appear', () => {
  it('sold-out and pause confirm in place, with no toast', () => {
    expect(source('src/components/dashboard/MenuPanel.tsx')).not.toMatch(/toast\(/);
    expect(source('src/components/dashboard/Dashboard.tsx')).not.toMatch(/Agent orders paused'[^)]*tone|Taking agent orders/);
  });

  it('the menu row is a plain list item', () => {
    expect(source('src/components/dashboard/MenuPanel.tsx')).not.toMatch(/Pressable/);
  });

  it('the toast animates in 220 ms from y:16 scale .98, out in 140 ms, tagged for the motion-off fallback', () => {
    const toast = source('src/components/ui/toast.tsx');
    expect(toast).toMatch(/AnimatePresence/);
    expect(toast).toMatch(/opacity: 0, y: 16, scale: 0\.98/);
    expect(toast).toMatch(/data-entrance/);
    expect(toast).toMatch(/duration: MOTION_S\.base/);
    expect(toast).toMatch(/duration: MOTION_S\.fast/);
    expect(toast).toMatch(/role="status"/);
    expect(toast).not.toMatch(/animate-rise-in/);
  });
});

describe('Animations these primitives need', () => {
  it('defines animate-pop (220 ms) and animate-nope', () => {
    expect(css).toMatch(/--animate-pop:\s*pop 220ms/);
    expect(css).toMatch(/--animate-nope:\s*nope /);
    expect(css).toMatch(/@keyframes pop/);
    expect(css).toMatch(/@keyframes nope/);
  });
});

describe('PayPal call sites', () => {
  it('Receipt and the assistant both use PayPalLink', () => {
    expect(source('src/app/o/[ref]/Receipt.tsx')).toMatch(/<PayPalLink/);
    expect(source('src/components/shop/BuyerConsole.tsx')).toMatch(/<PayPalLink/);
  });
});
