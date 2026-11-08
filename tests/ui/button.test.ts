import { createElement, type ReactElement } from 'react';
import { renderToStaticMarkup } from 'react-dom/server';
import { describe, expect, it, vi } from 'vitest';
import { Check } from 'lucide-react';
import { Button, ButtonLink, buttonClasses, type ButtonProps } from '@/components/ui/button';

const render = (props: Partial<ButtonProps> = {}, label = 'Save changes') =>
  renderToStaticMarkup(createElement(Button, { children: label, ...props }));

/** One entry per label layer: its name and whether it is hidden. */
function layers(html: string) {
  return [...html.matchAll(/<span data-layer="(\w+)" class="([^"]*)"/g)].map((m) => ({
    layer: m[1],
    hidden: /\binvisible\b/.test(m[2]) && /\bopacity-0\b/.test(m[2]),
    waits: m[2].includes('delay-(--pending-delay)'),
  }));
}

const shape = (html: string) => layers(html).map((l) => l.layer);
const opening = (html: string) => /<button[^>]*>/.exec(html)![0];

describe('Button states (acceptance 4)', () => {
  it('stacks the same three layers, in one grid cell, in every status', () => {
    const idle = render();
    expect(shape(idle)).toEqual(['idle', 'loading', 'success']);
    expect(shape(render({ loading: true }))).toEqual(shape(idle));
    expect(shape(render({ status: 'success' }))).toEqual(shape(idle));
    expect(opening(idle)).toContain('inline-grid');
    expect(opening(idle)).toContain('[&amp;&gt;*]:[grid-area:1/1]');
  });

  it('shows only the active layer; the others are invisible and transparent', () => {
    expect(layers(render()).map((l) => l.hidden)).toEqual([false, true, true]);
    expect(layers(render({ loading: true })).map((l) => l.hidden)).toEqual([true, false, true]);
    expect(layers(render({ status: 'success', successLabel: 'Saved' })).map((l) => l.hidden)).toEqual([true, true, false]);
  });

  it('loading sets aria-busy, aria-disabled and data-status, and never native disabled', () => {
    const tag = opening(render({ loading: true }));
    expect(tag).toContain('aria-busy="true"');
    expect(tag).toContain('aria-disabled="true"');
    expect(tag).toContain('data-status="loading"');
    expect(tag).not.toMatch(/\bdisabled=""/);
  });

  it('`loading` is an alias for status="loading"', () => {
    expect(render({ loading: true })).toBe(render({ status: 'loading' }));
  });

  it('success is aria-disabled and not busy', () => {
    const tag = opening(render({ status: 'success' }));
    expect(tag).toContain('aria-disabled="true"');
    expect(tag).not.toContain('aria-busy');
    expect(tag).toContain('data-status="success"');
  });

  it('a busy button shows progress rather than a dimmed not-allowed one', () => {
    const tag = opening(render({ loading: true }));
    expect(tag).toContain('cursor-progress');
    expect(tag).not.toContain('aria-disabled:opacity-50');
  });

  it('native disabled stays for a genuinely unavailable button', () => {
    const tag = opening(render({ disabled: true }));
    expect(tag).toMatch(/\bdisabled=""/);
    expect(tag).not.toContain('aria-disabled="true"');
    expect(tag).toContain('data-status="idle"');
  });

  it('a button both disabled and busy is aria-disabled, not native disabled, so it keeps focus', () => {
    const tag = opening(render({ disabled: true, loading: true }));
    expect(tag).not.toMatch(/\bdisabled=""/);
    expect(tag).toContain('aria-disabled="true"');
  });

  it('the idle label is the only text while idle (no duplicate labels for tests or screen readers)', () => {
    expect(render().match(/Save changes/g)).toHaveLength(1);
    expect(render({ loadingLabel: 'Saving…', successLabel: 'Saved' }).match(/Save changes/g)).toHaveLength(1);
  });

  it('holds the loadingLabel and successLabel in their layers so the width is set from the first paint', () => {
    const html = render({ loadingLabel: 'Saving…', successLabel: 'Saved' });
    expect(html).toContain('Saving…');
    expect(html).toContain('Saved');
  });

  it('keeps the visible label beside the spinner when the button has an icon and no loadingLabel', () => {
    const html = render({ loading: true, icon: Check });
    const loadingLayer = /<span data-layer="loading".*?<\/span><span data-layer="success"/.exec(html)![0];
    expect(loadingLayer).toContain('>Save changes<');
    expect(loadingLayer).not.toContain('sr-only');
  });

  it('a bare button gets only a spinner while loading, and keeps its name for screen readers', () => {
    const html = render({ loading: true });
    const loadingLayer = /<span data-layer="loading".*?<\/span><span data-layer="success"/.exec(html)![0];
    expect(loadingLayer).toContain('sr-only');
    expect(loadingLayer).toContain('animate-spin');
  });

  it('the spinner and the outgoing label wait for --pending-delay; success does not', () => {
    expect(layers(render({ loading: true })).map((l) => l.waits)).toEqual([true, true, false]);
    expect(layers(render({ status: 'success' })).map((l) => l.waits)).toEqual([false, false, false]);
    expect(layers(render()).map((l) => l.waits)).toEqual([false, false, false]);
  });

  it('only spins while loading', () => {
    expect(render()).not.toContain('animate-spin');
    expect(render({ loading: true })).toContain('animate-spin');
  });

  it('pops the tick on success', () => {
    expect(render({ status: 'success' })).toContain('animate-pop');
    expect(render()).not.toContain('animate-pop');
  });
});

describe('Button click guard', () => {
  const fakeClick = () => ({ preventDefault: vi.fn(), stopPropagation: vi.fn() });
  const onClickOf = (el: ReactElement) => (el.props as { onClick?: (e: unknown) => void }).onClick;

  it('blocks clicks while loading and while showing success, and stops a form submit', () => {
    for (const props of [{ loading: true }, { status: 'success' as const }]) {
      const spy = vi.fn();
      const event = fakeClick();
      onClickOf(Button({ ...props, onClick: spy, children: 'Save' }) as ReactElement)!(event);
      expect(spy).not.toHaveBeenCalled();
      expect(event.preventDefault).toHaveBeenCalled();
    }
  });

  it('passes clicks through when idle', () => {
    const spy = vi.fn();
    const event = fakeClick();
    onClickOf(Button({ onClick: spy, children: 'Save' }) as ReactElement)!(event);
    expect(spy).toHaveBeenCalledWith(event);
    expect(event.preventDefault).not.toHaveBeenCalled();
  });

  it('also guards a caller-set aria-disabled, now that pointer events reach it', () => {
    const spy = vi.fn();
    onClickOf(Button({ 'aria-disabled': true, onClick: spy, children: 'Save' }) as ReactElement)!(fakeClick());
    expect(spy).not.toHaveBeenCalled();
  });
});

describe('Button styling', () => {
  it('presses with the press utility and no pointer-events-none or active:translate', () => {
    const cls = buttonClasses();
    expect(cls.split(' ')).toContain('press');
    expect(cls).not.toContain('pointer-events-none');
    expect(cls).not.toContain('active:translate');
    expect(cls).not.toMatch(/transition-\[/);
  });

  it('presses a full-width button by the smaller wide scale, and only that one', () => {
    expect(buttonClasses({ fullWidth: true })).toContain('[--press-local:var(--press-scale-wide)]');
    expect(buttonClasses()).not.toContain('--press-local');
  });

  it('every variant has an active fill, on :active and on data-pressed', () => {
    for (const variant of ['primary', 'secondary', 'ghost', 'paypal'] as const) {
      const cls = buttonClasses({ variant });
      expect(cls).toContain(`active:bg-(--button-${variant}-bg-active)`);
      expect(cls).toContain(`data-pressed:bg-(--button-${variant}-bg-active)`);
    }
  });

  it('a genuinely unavailable button dims and refuses', () => {
    const cls = buttonClasses();
    expect(cls).toContain('disabled:opacity-50');
    expect(cls).toContain('aria-disabled:cursor-not-allowed');
  });

  it('ButtonLink stays a plain flex row (no state layers)', () => {
    const html = renderToStaticMarkup(createElement(ButtonLink, { href: '/x', children: 'Open' }));
    expect(html).not.toContain('data-layer');
    expect(html).not.toContain('inline-grid');
    expect(html).toContain('press');
  });

  it('buttonClasses() without options stays flex, for links and labels styled as buttons', () => {
    expect(buttonClasses().split(' ')).toContain('inline-flex');
  });
});
