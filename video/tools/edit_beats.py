# The edit of video/project/demo.json: per-scene beats (jump cuts), rates and caption placement for the final clips (7 Nov, 00:16 IST take).
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
    # the 28 s zoom (clip 01 is recorded at the opening line's length) at real speed.
    'problem': {'playbackRate': 1},
    # start page -> Snap -> photo -> Read my menu -> reading; then the result.
    'snap': {'captionPlacement': 'top', 'beats': [B(0, 0.2), B(6.0, 16.0)]},
    # focaccia card; the "2 for $7" card during its line; the email typed; Publish -> Adding -> live (1.5x); live, agent door.
    'review': {'captionPlacement': 'top', 'beats': [B(0, 0.5), B(2.5, 5.3), B(5.6, 21.0), B(9.6, 25.0, 1.5), B(13.3, 31.1)]},
    # the case photo / Finding; the crops; Use -> Added; the rows filled in.
    'counter': {'beats': [B(0, 8.3), B(2.6, 12.5), B(4.4, 17.5), B(5.9, 21.8)]},
    # Share tab (agent door, card); the card page.
    'card': {'captionPlacement': 'top', 'beats': [B(0, 2.9), B(2.2, 6.2)]},
    # command typed (2.5x); shop page fetched; refused tries cut -> the <link> to the agent door, "MCP server at /mcp"; MCP calls (2.5x);
    # create_order; the answer with the PayPal link.
    'discovery': {'captionPlacement': 'top', 'beats': [B(0, 3.4, 2.5), B(3.8, 14.6), B(5.2, 46.6), B(6.7, 48.1, 2.5), B(8.5, 52.6), B(9.9, 56.5)]},
    # shop page -> open the console; the request typed (2x); Activity + the nut warning; the reply typed (2x);
    # create_order -> $27.00 card -> Approve.
    'console': {'captionPlacement': 'top', 'beats': [B(0, 0.8), B(3.6, 4.4, 2.0), B(6.2, 11.4), B(10.4, 22.7, 2.0), B(12.0, 29.3)]},
    # PayPal review -> Complete Purchase; PayPal's wait cut -> the receipt (Paid, Rosa's account); the console card Paid.
    'paypal': {'captionPlacement': 'top', 'beats': [B(0, 2.3), B(2.6, 10.6), B(9.6, 20.3)]},
    # comment + curl typed (2.5x); the INVALID_ARGUMENTS answer.
    'tamper': {'beats': [B(0, 1.2, 2.5), B(2.6, 12.6)]},
    # the dashboard left open -> toast + glow at "paid"; the row's brief; the order page's AI brief during the allergy line.
    'dashboard': {'captionPlacement': 'top', 'videoStartSec': 1.6},
    # number typed -> Save -> Shipped; the console: Where's my order? -> the tracking number (2x).
    'tracking': {'captionPlacement': 'top', 'beats': [B(0, 8.6), B(1.6, 18.6, 2.0)]},
}
for s in d['timeline']:
    if s.get('id') in edit:
        s.update(edit[s['id']])
open(p, 'w', encoding='utf-8').write(json.dumps(d, indent=2, ensure_ascii=False) + '\n')
print('ok')
