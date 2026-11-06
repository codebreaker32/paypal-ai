# Draft edit of video/project/demo.json: per-scene beats (jump cuts), rates and caption placement for the trial clips.
import json
import sys

p = sys.argv[1]
d = json.load(open(p, encoding='utf-8'))


def B(at, vs, rate=None):
    b = {'atSec': at, 'shot': 'screen', 'videoStartSec': vs}
    if rate is not None:
        b['playbackRate'] = rate
    return b


edit = {
    # 10 s zoom stretched over the opening line (slower, never frozen).
    'problem': {'playbackRate': 0.365},
    # start page -> Snap -> photo -> Read my menu -> reading; then the result.
    'snap': {'captionPlacement': 'top', 'beats': [B(0, 0.2), B(6.0, 15.6)]},
    # focaccia card; the "2 for $7" card during its line; the email typed; Publish -> Adding -> live (1.5x); live, agent door.
    'review': {'captionPlacement': 'top', 'beats': [B(0, 0.5), B(2.5, 5.3), B(5.6, 21.0), B(9.6, 25.0, 1.5), B(13.3, 30.5)]},
    # the case photo / Finding; the crops; Use -> Added; the rows filled in.
    'counter': {'beats': [B(0, 8.3), B(2.6, 11.6), B(4.4, 16.8), B(5.9, 21.2)]},
    # Share tab (agent door, card); the card page.
    'card': {'captionPlacement': 'top', 'beats': [B(0, 2.9), B(2.2, 6.1)]},
    # command typed (2.5x); shop page fetched; refused tries cut -> "There's an MCP endpoint"; MCP calls (2.5x);
    # create_order; the answer with the PayPal link.
    'discovery': {'captionPlacement': 'top', 'beats': [B(0, 3.4, 2.5), B(3.8, 14.6), B(5.2, 26.8), B(6.7, 38.5, 2.5), B(8.5, 44.8), B(9.9, 49.6)]},
    # shop page -> open the console; the request typed (2x); Activity + the nut warning; the reply typed (2x);
    # create_order -> $27.00 card -> Approve.
    'console': {'captionPlacement': 'top', 'beats': [B(0, 0.8), B(3.6, 4.4, 2.0), B(6.2, 11.0), B(10.4, 22.5, 2.0), B(12.0, 28.5)]},
    # PayPal review -> Complete Purchase; PayPal's wait cut -> the receipt (Paid, Rosa's account); the console card Paid.
    'paypal': {'captionPlacement': 'top', 'beats': [B(0, 2.3), B(2.6, 11.0), B(9.6, 21.0)]},
    # comment + curl typed (2.5x); the INVALID_ARGUMENTS answer.
    'tamper': {'beats': [B(0, 1.2, 2.5), B(2.6, 12.6)]},
    # the dashboard left open -> toast + glow at "paid"; the row's brief; the order page's AI brief during the allergy line.
    'dashboard': {'captionPlacement': 'top', 'videoStartSec': 1.6},
    # number typed -> Save -> Shipped; the console: Where's my order? -> the tracking number (2x).
    'tracking': {'captionPlacement': 'top', 'beats': [B(0, 8.6), B(1.6, 19.0, 2.0)]},
}
for s in d['timeline']:
    if s.get('id') in edit:
        s.update(edit[s['id']])
open(p, 'w', encoding='utf-8').write(json.dumps(d, indent=2, ensure_ascii=False) + '\n')
print('ok')
