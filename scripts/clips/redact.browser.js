// Injected into every page and frame of a clip's browser (context.addInitScript, scripts/clips/redact.ts) before the
// page's own scripts run, so no recorded frame shows a sandbox login or an owner link. A MutationObserver rewrites text
// as it is added or changed, before the browser paints it:
//   - each [from, to] pair: a sandbox login (case-insensitive) becomes the app's own masked form (maskEmail, r•••@…);
//   - an owner link's token (/claim/<token>) becomes dots;
//   - an input or textarea whose value holds a login is drawn as dots (its value is left alone, so forms still work).
// A function expression, called with the pairs: `(<this file>)([["login", "masked"], …])`. Plain browser JS.
// eslint-disable-next-line @typescript-eslint/no-unused-expressions -- a function expression, called by redact.ts
(pairs) => {
  const esc = (s) => s.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
  const rules = pairs.map(([from, to]) => [new RegExp(esc(from), 'gi'), to]);
  const CLAIM = /\/claim\/[A-Za-z0-9_-]{8,}/g;
  const fix = (s) => {
    let t = s;
    for (const [re, to] of rules) t = t.replace(re, to);
    return t.replace(CLAIM, '/claim/••••••••');
  };
  const ATTRS = ['href', 'title', 'aria-label', 'alt', 'placeholder', 'aria-description'];
  // Never rewrite what isn't drawn: a page's own data (PayPal keeps the login it posts in a script tag) must stay intact.
  const HIDDEN = new Set(['SCRIPT', 'STYLE', 'TEMPLATE', 'NOSCRIPT', 'TEXTAREA']);
  const scrubText = (n) => {
    if (n.parentNode && HIDDEN.has(n.parentNode.nodeName)) return;
    const v = n.nodeValue;
    if (v && v.length > 4) {
      const f = fix(v);
      if (f !== v) n.nodeValue = f;
    }
  };
  const scrubEl = (el) => {
    if (!el.getAttribute) return;
    for (const a of ATTRS) {
      const v = el.getAttribute(a);
      if (v) {
        const f = fix(v);
        if (f !== v) el.setAttribute(a, f);
      }
    }
    if ((el.tagName === 'INPUT' || el.tagName === 'TEXTAREA') && el.value && fix(el.value) !== el.value) {
      el.style.setProperty('-webkit-text-security', 'disc');
    }
  };
  const scrubTree = (root) => {
    if (root.nodeType === 3) return scrubText(root);
    if (root.nodeType === 1) scrubEl(root);
    if (root.nodeType !== 1 && root.nodeType !== 9 && root.nodeType !== 11) return;
    const walker = document.createTreeWalker(root, NodeFilter.SHOW_ELEMENT | NodeFilter.SHOW_TEXT);
    for (let n = walker.nextNode(); n; n = walker.nextNode()) {
      if (n.nodeType === 3) scrubText(n);
      else scrubEl(n);
    }
  };
  new MutationObserver((records) => {
    for (const r of records) {
      if (r.type === 'characterData') scrubText(r.target);
      else if (r.type === 'attributes') scrubEl(r.target);
      else for (const n of r.addedNodes) scrubTree(n);
    }
  }).observe(document, { subtree: true, childList: true, characterData: true, attributes: true, attributeFilter: ATTRS });
  // Values typed or set by script don't show up as mutations.
  const onValue = (e) => e.target && scrubEl(e.target);
  document.addEventListener('input', onValue, true);
  document.addEventListener('change', onValue, true);
  document.addEventListener('DOMContentLoaded', () => scrubTree(document), { once: true });
}
