import { createElement as h } from 'react';
import { renderToStaticMarkup } from 'react-dom/server';
import { describe, expect, it } from 'vitest';
import { LinkRow, Panel, PanelList, PanelRow } from '@/components/ui/panel';

describe('Panel', () => {
  it('is a section named by its heading, with the count and the value on the title row', () => {
    const html = renderToStaticMarkup(h(Panel, { heading: 'To prepare', count: 2, value: '$43.50' }, h('p', null, 'body')));
    const id = html.match(/aria-labelledby="([^"]+)"/)![1];
    expect(html).toContain(`<h2 id="${id}"`);
    expect(html).toContain('type-section');
    expect(html).toContain('>2</span>');
    expect(html).toContain('$43.50');
  });
  it('leaves out the value when there is none', () => {
    expect(renderToStaticMarkup(h(Panel, { heading: 'Done' }, 'x'))).not.toContain('ml-auto');
  });
});

describe('PanelList and rows', () => {
  it('rows are li inside a size container', () => {
    const html = renderToStaticMarkup(h(PanelList, null, h(PanelRow, { action: h('button', null, 'Copy') }, 'Text')));
    expect(html).toMatch(/^<ul[^>]*@container/);
    expect(html).toContain('<li');
    expect(html).toContain('@xl:grid-cols-[minmax(0,1fr)_auto]');
    expect(html.indexOf('Text')).toBeLessThan(html.indexOf('Copy'));
  });
  it('a row without an action has no action cell', () => {
    expect(renderToStaticMarkup(h(PanelRow, null, 'Text'))).not.toContain('justify-self-end');
  });
  it('LinkRow is one link inside one li', () => {
    const html = renderToStaticMarkup(h(LinkRow, { href: '/shops/1', title: 'Rosa', detail: 'Live' }));
    expect(html.startsWith('<li><a')).toBe(true);
    expect((html.match(/<a /g) ?? []).length).toBe(1);
  });
});
