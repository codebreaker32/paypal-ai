// The page a person sees when they open an agent door link (GET /s/<slug>/mcp) in a browser. Self-contained HTML:
// no external scripts or styles, one tiny inline script for the Copy button.

/** True when the request comes from a browser (its Accept header asks for HTML). MCP clients never ask for it. */
export function wantsHtml(req: Request): boolean {
  return (req.headers.get('accept') ?? '').toLowerCase().includes('text/html');
}

export function escapeHtml(s: string): string {
  return s
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&#39;');
}

export function agentDoorPage(p: { shopName: string; slug: string; appUrl: string }): string {
  const name = escapeHtml(p.shopName);
  const shopUrl = `${p.appUrl}/s/${encodeURIComponent(p.slug)}`;
  const doorUrl = `${shopUrl}/mcp`;
  const door = escapeHtml(doorUrl);
  const shop = escapeHtml(shopUrl);
  const cmd = escapeHtml(`claude mcp add --transport http ${p.slug} ${doorUrl}`);
  return `<!doctype html>
<html lang="en">
<head>
<meta charset="utf-8">
<meta name="viewport" content="width=device-width, initial-scale=1">
<meta name="robots" content="noindex">
<title>${name}: link for AI assistants</title>
<style>
:root{--ink:#1a1a1f;--soft:#5b5b66;--line:#e6e6ea;--accent:#c21a4b;--tint:#f6f6f8}
*{box-sizing:border-box}
body{margin:0;background:#fff;color:var(--ink);font-family:Figtree,ui-sans-serif,system-ui,-apple-system,"Segoe UI",Roboto,sans-serif;line-height:1.5;-webkit-font-smoothing:antialiased}
main{max-width:36rem;margin:0 auto;padding:48px 16px 64px}
.eyebrow{margin:0 0 8px;font-size:.8125rem;font-weight:600;letter-spacing:.04em;text-transform:uppercase;color:var(--accent)}
h1{margin:0 0 12px;font-size:1.75rem;line-height:1.2;font-weight:700}
h2{margin:40px 0 8px;font-size:1.125rem;font-weight:700}
p{margin:0 0 16px;color:var(--soft)}
.btn{display:inline-flex;align-items:center;justify-content:center;min-height:48px;padding:0 24px;border-radius:999px;background:var(--accent);color:#fff;font-weight:600;font-size:1rem;text-decoration:none;text-align:center}
.btn:hover{background:#a8153f}
.btn:focus-visible,.copy:focus-visible{outline:3px solid var(--ink);outline-offset:2px}
.primary{width:100%;margin-top:8px}
.url{display:flex;gap:8px;align-items:stretch;border:1px solid var(--line);border-radius:12px;background:var(--tint);padding:6px 6px 6px 12px}
.url code{flex:1;min-width:0;align-self:center;overflow-wrap:anywhere;font-size:.875rem;font-family:ui-monospace,SFMono-Regular,Menlo,Consolas,monospace}
.copy{flex-shrink:0;min-height:40px;padding:0 16px;border-radius:999px;border:1px solid var(--line);background:#fff;color:var(--ink);font-weight:600;font-family:inherit;font-size:.875rem;cursor:pointer}
ol{margin:16px 0 0;padding-left:20px;color:var(--soft)}
li{margin-bottom:12px}
li strong{color:var(--ink)}
li code{font-family:ui-monospace,SFMono-Regular,Menlo,Consolas,monospace;font-size:.8125rem;background:var(--tint);border:1px solid var(--line);border-radius:6px;padding:1px 6px;overflow-wrap:anywhere}
footer{margin-top:40px;font-size:.8125rem;color:var(--soft)}
</style>
</head>
<body>
<main>
<p class="eyebrow">Agent door</p>
<h1>This link is for AI assistants</h1>
<p>It lets an AI assistant (Claude, ChatGPT, Cursor and others) browse ${name}'s menu and place orders, paid with PayPal. It is not a web page for people.</p>
<a class="btn primary" href="${shop}">Open ${name}'s shop</a>

<h2>Add it to your AI assistant</h2>
<div class="url">
<code id="door">${door}</code>
<button type="button" class="copy" id="copy" aria-label="Copy the agent door link">Copy</button>
</div>
<ol>
<li><strong>Claude:</strong> Settings, then Connectors, then Add custom connector. Paste the link above.</li>
<li><strong>Claude Code:</strong> run <code>${cmd}</code></li>
<li><strong>Any MCP client:</strong> add the link as a Streamable HTTP server.</li>
</ol>
<footer>Ordering through Shelfie. Payment is handled by PayPal.</footer>
</main>
<script>
(function(){var b=document.getElementById('copy'),c=document.getElementById('door');b.addEventListener('click',function(){var t=c.textContent;function done(){b.textContent='Copied';setTimeout(function(){b.textContent='Copy'},2000)}if(navigator.clipboard){navigator.clipboard.writeText(t).then(done,function(){})}else{var r=document.createRange();r.selectNodeContents(c);var s=getSelection();s.removeAllRanges();s.addRange(r)}})})();
</script>
</body>
</html>`;
}
