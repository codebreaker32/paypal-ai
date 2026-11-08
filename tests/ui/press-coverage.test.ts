// Every control in the app answers a press (brief WP1, Controls). A raw <button>, <a>, <Link>, <summary>, or a <label>
// that wraps a file or radio input carries one of the press utilities, gets its look from a primitive (`buttonClasses`),
// presses the row around it (`data-stretched-link`), or is named below with its reason. And no transition list may name
// `transform` for a press, nor any `active:` class move a control: Tailwind 4's translate-* and scale-* write the CSS
// `translate` and `scale` properties, which such a list does not cover, so the press would snap.
import fs from 'node:fs';
import path from 'node:path';
import ts from 'typescript';
import { describe, expect, it } from 'vitest';

const root = path.resolve(import.meta.dirname, '../..');

/** Controls that deliberately take no press utility. Keep this short: `file <tag>` and the reason. */
const ALLOWED: Record<string, string> = {
  'src/app/layout.tsx <a>': 'The skip link: only ever seen on keyboard focus, and it moves focus rather than presses.',
};

function filesIn(dir: string, extensions: string[]): string[] {
  return fs.readdirSync(dir, { withFileTypes: true }).flatMap((e) => {
    const full = path.join(dir, e.name);
    return e.isDirectory() ? filesIn(full, extensions) : extensions.some((x) => e.name.endsWith(x)) ? [full] : [];
  });
}

const PRESS_CLASS = /(?<![\w-])press(-(icon|text|surface|switch))?(?![\w-])/;
const PRIMITIVE_CLASS = /\bbuttonClasses\(|\bbuttonVariants\(/;

type JsxTag = ts.JsxOpeningElement | ts.JsxSelfClosingElement;

function tagOf(node: ts.Node): JsxTag | null {
  if (ts.isJsxElement(node)) return node.openingElement;
  return ts.isJsxSelfClosingElement(node) ? node : null;
}

function attribute(tag: JsxTag, name: string): ts.JsxAttribute | undefined {
  return tag.attributes.properties.filter(ts.isJsxAttribute).find((a) => a.name.getText() === name);
}

/** Whether a <label>'s children contain an <input> of one of these types. */
function wrapsInputOfType(label: ts.Node, types: string[]): boolean {
  let found = false;
  const visit = (node: ts.Node) => {
    const tag = tagOf(node);
    if (tag?.tagName.getText() === 'input') {
      const type = attribute(tag, 'type')?.initializer;
      if (type && ts.isStringLiteral(type) && types.includes(type.text)) found = true;
    }
    ts.forEachChild(node, visit);
  };
  visit(label);
  return found;
}

/** The text of every top-level or function-level `const NAME = ...`, so a className held in a constant can be read. */
function constantsOf(source: ts.SourceFile): Map<string, string> {
  const constants = new Map<string, string>();
  const visit = (node: ts.Node) => {
    if (ts.isVariableDeclaration(node) && ts.isIdentifier(node.name) && node.initializer) {
      constants.set(node.name.text, node.initializer.getText(source));
    }
    ts.forEachChild(node, visit);
  };
  visit(source);
  return constants;
}

/** A className's source text, with any constant it names filled in. */
function classText(tag: JsxTag, constants: Map<string, string>, source: ts.SourceFile): string {
  const initializer = attribute(tag, 'className')?.initializer;
  if (!initializer) return '';
  const parts = [initializer.getText(source)];
  const visit = (node: ts.Node) => {
    if (ts.isIdentifier(node) && constants.has(node.text)) parts.push(constants.get(node.text) as string);
    ts.forEachChild(node, visit);
  };
  visit(initializer);
  return parts.join(' ');
}

interface Control {
  key: string;
  where: string;
  covered: boolean;
}

function controlsIn(file: string): Control[] {
  const relative = path.relative(root, file);
  const source = ts.createSourceFile(file, fs.readFileSync(file, 'utf8'), ts.ScriptTarget.Latest, true, ts.ScriptKind.TSX);
  const constants = constantsOf(source);
  const found: Control[] = [];

  const visit = (node: ts.Node) => {
    const tag = tagOf(node);
    if (tag) {
      const name = tag.tagName.getText(source);
      const isControl =
        name === 'button' ||
        name === 'a' ||
        name === 'Link' ||
        name === 'summary' ||
        (name === 'label' && wrapsInputOfType(node, ['file', 'radio']));
      if (isControl) {
        const classes = classText(tag, constants, source);
        const line = source.getLineAndCharacterOfPosition(tag.getStart(source)).line + 1;
        found.push({
          key: `${relative} <${name}>`,
          where: `${relative}:${line} <${name}>`,
          covered: PRESS_CLASS.test(classes) || PRIMITIVE_CLASS.test(classes) || !!attribute(tag, 'data-stretched-link'),
        });
      }
    }
    ts.forEachChild(node, visit);
  };
  visit(source);
  return found;
}

const allControls = () => filesIn(path.join(root, 'src'), ['.tsx']).flatMap(controlsIn);

describe('press coverage', () => {
  it('finds the controls it is meant to check, including every kind', () => {
    const controls = allControls();
    expect(controls.length).toBeGreaterThan(25);
    for (const kind of ['<button>', '<a>', '<Link>', '<summary>', '<label>']) {
      expect(controls.filter((c) => c.key.endsWith(kind)).length, kind).toBeGreaterThan(0);
    }
  });

  it('every button, link, summary and file or radio label answers a press', () => {
    const uncovered = allControls()
      .filter((c) => !c.covered && !(c.key in ALLOWED))
      .map((c) => c.where);
    expect(uncovered).toEqual([]);
  });

  it('the allowlist names only controls that still need it', () => {
    const controls = allControls();
    const stale = Object.keys(ALLOWED).filter((key) => !controls.some((c) => c.key === key && !c.covered));
    expect(stale).toEqual([]);
  });

  it('no transition list names transform, and no active: class moves a control', () => {
    const banned = /transition-\[[^\]]*transform[^\]]*\]|active:-?(?:translate|scale)-/g;
    const hits = filesIn(path.join(root, 'src'), ['.ts', '.tsx', '.css']).flatMap((file) =>
      fs
        .readFileSync(file, 'utf8')
        .split('\n')
        .flatMap((text, i) => (text.match(banned) ?? []).map((match) => `${path.relative(root, file)}:${i + 1} ${match}`)),
    );
    expect(hits).toEqual([]);
  });
});
