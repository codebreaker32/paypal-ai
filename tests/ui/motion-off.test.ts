// When motion's features never load (load-features.ts gives up and sets html[data-motion-off]), no entrance plays, so
// globals.css must show everything that starts hidden for one. Every `m.*` element with an entrance (`initial` other
// than `false`) carries `data-entrance`, which the fallback rule covers; the primitives keep their own data-slot rules.
import fs from 'node:fs';
import path from 'node:path';
import ts from 'typescript';
import { describe, expect, it } from 'vitest';

const root = path.resolve(import.meta.dirname, '../..');
const css = fs.readFileSync(path.join(root, 'src/app/globals.css'), 'utf8');

/** The selectors of the rule that forces hidden entrances visible under html[data-motion-off]. */
function fallbackSelectors(): string[] {
  const rule = /((?:html\[data-motion-off\][^{,]*,\s*)*html\[data-motion-off\][^{,]*)\{([^}]*)\}/.exec(css);
  if (!rule) throw new Error('no html[data-motion-off] rule in globals.css');
  expect(rule[2]).toMatch(/opacity:\s*1\s*!important/);
  expect(rule[2]).toMatch(/transform:\s*none\s*!important/);
  return rule[1].split(',').map((s) => s.trim().replace(/\s+/g, ' '));
}

function tsxFiles(dir: string): string[] {
  return fs.readdirSync(dir, { withFileTypes: true }).flatMap((e) => {
    const full = path.join(dir, e.name);
    return e.isDirectory() ? tsxFiles(full) : e.name.endsWith('.tsx') ? [full] : [];
  });
}

/** `<m.div initial={…}>` elements whose `initial` isn't the literal `false`, and whether each has data-entrance. */
function entrances(file: string): { where: string; tagged: boolean }[] {
  const source = ts.createSourceFile(file, fs.readFileSync(file, 'utf8'), ts.ScriptTarget.Latest, true, ts.ScriptKind.TSX);
  const found: { where: string; tagged: boolean }[] = [];
  const visit = (node: ts.Node) => {
    if ((ts.isJsxOpeningElement(node) || ts.isJsxSelfClosingElement(node)) && /^m\.\w+$/.test(node.tagName.getText(source))) {
      const attrs = node.attributes.properties.filter(ts.isJsxAttribute);
      const initial = attrs.find((a) => a.name.getText(source) === 'initial');
      const startsVisible = initial?.initializer && ts.isJsxExpression(initial.initializer) && initial.initializer.expression?.kind === ts.SyntaxKind.FalseKeyword;
      if (initial && !startsVisible) {
        const line = source.getLineAndCharacterOfPosition(node.getStart(source)).line + 1;
        found.push({ where: `${path.relative(root, file)}:${line}`, tagged: attrs.some((a) => a.name.getText(source) === 'data-entrance') });
      }
    }
    ts.forEachChild(node, visit);
  };
  visit(source);
  return found;
}

describe('the motion-off fallback', () => {
  it('covers the primitives’ slots and any element tagged data-entrance', () => {
    expect(fallbackSelectors()).toEqual(
      expect.arrayContaining([
        'html[data-motion-off] [data-slot="reveal"]',
        'html[data-motion-off] [data-slot="stagger-item"]',
        'html[data-motion-off] [data-slot="status-swap"] > *',
        'html[data-motion-off] [data-entrance]',
      ]),
    );
  });

  it('every m.* element that starts hidden for an entrance is tagged data-entrance (console entries, the live beat)', () => {
    const all = tsxFiles(path.join(root, 'src')).flatMap(entrances);
    // The console's entries and the live step's beat are among them, so this test can't pass by finding nothing.
    expect(all.map((e) => e.where.split(':')[0])).toEqual(expect.arrayContaining(['src/components/shop/BuyerConsole.tsx', 'src/components/setup/LiveStep.tsx']));
    expect(all.filter((e) => !e.tagged).map((e) => e.where)).toEqual([]);
  });
});
