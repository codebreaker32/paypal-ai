// Static checks over every route handler and seller page (SR2, SR16): the rules that must hold for code not yet written.
import fs from 'node:fs';
import path from 'node:path';
import ts from 'typescript';
import { describe, expect, it } from 'vitest';

const ROOT = process.cwd();
const APP = path.join(ROOT, 'src/app');
const IMAGE_ROUTES = 'src/lib/catalog/shop-image-route.ts';
const WRITE_METHODS = ['POST', 'PUT', 'PATCH', 'DELETE'];
const ALL_METHODS = ['GET', 'HEAD', 'OPTIONS', ...WRITE_METHODS];
const SAME_ORIGIN_EXEMPT = ['src/app/api/paypal/webhook/route.ts']; // PayPal calls it, with its own signature check

function filesUnder(dir: string, match: (name: string) => boolean): string[] {
  return fs.readdirSync(dir, { withFileTypes: true }).flatMap((e) => {
    const p = path.join(dir, e.name);
    if (e.isDirectory()) return filesUnder(p, match);
    return match(e.name) ? [path.relative(ROOT, p).split(path.sep).join('/')] : [];
  });
}

const parse = (file: string): ts.SourceFile =>
  ts.createSourceFile(file, fs.readFileSync(path.join(ROOT, file), 'utf8'), ts.ScriptTarget.Latest, true, file.endsWith('.tsx') ? ts.ScriptKind.TSX : ts.ScriptKind.TS);

type Fn = ts.FunctionDeclaration | ts.ArrowFunction | ts.FunctionExpression;
const isExported = (n: ts.Node) => (ts.getCombinedModifierFlags(n as ts.Declaration) & ts.ModifierFlags.Export) !== 0;

interface Handler {
  file: string;
  method: string;
  /** Null for `export const POST = routes.POST`, whose body is checked in shop-image-route.ts. */
  fn: Fn | null;
}

function handlersIn(file: string, methods: string[]): Handler[] {
  const source = parse(file);
  const found: Handler[] = [];
  for (const statement of source.statements) {
    if (ts.isExportDeclaration(statement) && statement.exportClause && ts.isNamedExports(statement.exportClause)) {
      for (const el of statement.exportClause.elements) {
        if (methods.includes(el.name.text)) throw new Error(`${file}: ${el.name.text} is re-exported; declare it where it can be checked`);
      }
    }
    if (ts.isFunctionDeclaration(statement) && isExported(statement) && statement.name && methods.includes(statement.name.text)) {
      found.push({ file, method: statement.name.text, fn: statement });
    }
    if (ts.isVariableStatement(statement) && isExported(statement)) {
      for (const decl of statement.declarationList.declarations) {
        if (!ts.isIdentifier(decl.name) || !methods.includes(decl.name.text)) continue;
        const init = decl.initializer;
        if (init && (ts.isArrowFunction(init) || ts.isFunctionExpression(init))) {
          found.push({ file, method: decl.name.text, fn: init });
        } else if (init && ts.isPropertyAccessExpression(init) && init.expression.getText(source) === 'routes' && init.name.text === decl.name.text) {
          expect(source.text, `${file}: routes must come from shopImageRoutes`).toMatch(/const routes = shopImageRoutes\(/);
          found.push({ file, method: decl.name.text, fn: null });
        } else {
          throw new Error(`${file}: exported ${decl.name.text} has a form this guard cannot read`);
        }
      }
    }
  }
  return found;
}

/** The handlers `shopImageRoutes` builds: every cover and logo route is one of these. */
function imageRouteHandlers(methods: string[]): Handler[] {
  const source = parse(IMAGE_ROUTES);
  const found: Handler[] = [];
  const visit = (node: ts.Node): void => {
    if (ts.isFunctionDeclaration(node) && node.name && methods.includes(node.name.text)) {
      found.push({ file: IMAGE_ROUTES, method: node.name.text, fn: node });
    }
    ts.forEachChild(node, visit);
  };
  visit(source);
  return found;
}

const writeRoutes = filesUnder(path.join(APP, 'api'), (n) => n === 'route.ts' || n === 'route.tsx');
const routeFiles = writeRoutes.filter((f) => !SAME_ORIGIN_EXEMPT.includes(f));

/** `const refused = assertSameOrigin(req); if (refused) return refused;` as the first two statements. */
function startsWithOriginCheck(fn: Fn, sourceFile: ts.SourceFile): boolean {
  if (!fn.body || !ts.isBlock(fn.body)) return false;
  const param = fn.parameters[0]?.name.getText(sourceFile);
  if (!param) return false;
  const [first, second] = fn.body.statements;
  if (!first || !ts.isVariableStatement(first)) return false;
  const decl = first.declarationList.declarations[0];
  if (!decl?.initializer || !ts.isCallExpression(decl.initializer) || !ts.isIdentifier(decl.name)) return false;
  if (decl.initializer.expression.getText(sourceFile) !== 'assertSameOrigin') return false;
  if (decl.initializer.arguments[0]?.getText(sourceFile) !== param) return false;
  const name = decl.name.text;
  return (
    !!second &&
    ts.isIfStatement(second) &&
    second.expression.getText(sourceFile) === name &&
    second.thenStatement.getText(sourceFile).replace(/[\s{};]/g, '') === `return${name}`
  );
}

describe('SR2: assertSameOrigin is the first statement of every state-changing API handler', () => {
  const handlers = routeFiles.flatMap((f) => handlersIn(f, WRITE_METHODS));

  it('finds the handlers (the route tree has not moved)', () => {
    expect(handlers.length).toBeGreaterThan(15);
  });

  it('exempts only paypal/webhook', () => {
    expect(SAME_ORIGIN_EXEMPT).toEqual(['src/app/api/paypal/webhook/route.ts']);
    expect(fs.existsSync(path.join(ROOT, SAME_ORIGIN_EXEMPT[0]))).toBe(true);
  });

  it.each(handlers.filter((h) => h.fn).map((h) => [`${h.method} ${h.file}`, h] as const))('%s', (_, h) => {
    expect(startsWithOriginCheck(h.fn!, parse(h.file))).toBe(true);
  });

  it.each(imageRouteHandlers(WRITE_METHODS).map((h) => [`${h.method} ${h.file}`, h] as const))('%s', (_, h) => {
    expect(startsWithOriginCheck(h.fn!, parse(h.file))).toBe(true);
  });

  it('routes.* exports are only POST and DELETE from shopImageRoutes', () => {
    const delegated = handlers.filter((h) => !h.fn);
    expect(delegated.length).toBeGreaterThan(0);
    for (const h of delegated) expect(['POST', 'DELETE']).toContain(h.method);
    expect(imageRouteHandlers(WRITE_METHODS).map((h) => h.method).sort()).toEqual(['DELETE', 'POST']);
  });
});

function containsCall(fn: Fn, names: string[]): boolean {
  let found = false;
  const visit = (node: ts.Node): void => {
    if (ts.isCallExpression(node) && ts.isIdentifier(node.expression) && names.includes(node.expression.text)) found = true;
    ts.forEachChild(node, visit);
  };
  if (fn.body) visit(fn.body);
  return found;
}

describe('SR16: every owner surface checks the owner', () => {
  const API_SHOP = path.join(APP, 'api/shops/[id]');
  const shopRoutes = filesUnder(API_SHOP, (n) => n === 'route.ts');
  const handlers = shopRoutes.flatMap((f) => handlersIn(f, ALL_METHODS));

  it('finds the handlers', () => {
    expect(shopRoutes.length).toBeGreaterThan(8);
    expect(handlers.length).toBeGreaterThan(12);
  });

  it.each(handlers.filter((h) => h.fn).map((h) => [`${h.method} ${h.file}`, h] as const))('%s', (_, h) => {
    expect(containsCall(h.fn!, ['ownedShop', 'getOwnedShop'])).toBe(true);
  });

  it.each(imageRouteHandlers(ALL_METHODS).map((h) => [`${h.method} ${h.file}`, h] as const))('%s', (_, h) => {
    expect(containsCall(h.fn!, ['ownedShop', 'getOwnedShop'])).toBe(true);
  });

  const pages = filesUnder(path.join(APP, 'shops/[id]'), (n) => n === 'page.tsx' || n === 'layout.tsx');

  it('finds the seller pages and layouts', () => {
    expect(pages.length).toBeGreaterThanOrEqual(5);
  });

  function defaultExport(file: string): Fn {
    const source = parse(file);
    for (const statement of source.statements) {
      const flags = ts.getCombinedModifierFlags(statement as unknown as ts.Declaration);
      if (ts.isFunctionDeclaration(statement) && flags & ts.ModifierFlags.Default) return statement;
    }
    throw new Error(`${file} has no default-exported function`);
  }

  it.each(pages)('%s calls requireOwner', (file) => {
    expect(containsCall(defaultExport(file), ['requireOwner'])).toBe(true);
  });
});
