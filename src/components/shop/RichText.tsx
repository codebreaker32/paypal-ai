import { Fragment, type ReactNode } from 'react';

/** **bold** spans inside a line; everything else stays plain text (no HTML is ever interpreted). */
function inline(text: string): ReactNode[] {
  return text.split(/(\*\*[^*]+\*\*)/g).map((part, i) =>
    part.startsWith('**') && part.endsWith('**') && part.length > 4 ? (
      <strong key={i} className="font-semibold">
        {part.slice(2, -2)}
      </strong>
    ) : (
      <Fragment key={i}>{part}</Fragment>
    ),
  );
}

type Block = { kind: 'p'; lines: string[] } | { kind: 'ul' | 'ol'; items: string[] };

const BULLET = /^\s*(?:[-*•])\s+(.*)$/;
const NUMBERED = /^\s*\d+[.)]\s+(.*)$/;

/**
 * The assistant's reply as paragraphs and simple lists. Claude is asked for plain text; this keeps the occasional
 * "- item" list and **bold** readable without rendering markdown or HTML.
 */
export function RichText({ text, className }: { text: string; className?: string }) {
  const blocks: Block[] = [];
  for (const raw of text.replace(/\r\n/g, '\n').split('\n')) {
    const line = raw.replace(/^#{1,6}\s+/, '');
    const last = blocks.at(-1);
    const bullet = BULLET.exec(line);
    const numbered = !bullet && NUMBERED.exec(line);
    if (bullet || numbered) {
      const kind = bullet ? 'ul' : 'ol';
      const item = (bullet || numbered) as RegExpExecArray;
      if (last && last.kind === kind) last.items.push(item[1]);
      else blocks.push({ kind, items: [item[1]] });
    } else if (line.trim() === '') {
      blocks.push({ kind: 'p', lines: [] });
    } else if (last?.kind === 'p') {
      last.lines.push(line);
    } else {
      blocks.push({ kind: 'p', lines: [line] });
    }
  }
  return (
    <div className={className}>
      {blocks.map((b, i) => {
        if (b.kind === 'p') {
          if (!b.lines.length) return null;
          return (
            <p key={i} className="[&+*]:mt-2">
              {b.lines.map((l, j) => (
                <Fragment key={j}>
                  {j > 0 && <br />}
                  {inline(l)}
                </Fragment>
              ))}
            </p>
          );
        }
        const List = b.kind;
        return (
          <List key={i} className={`${b.kind === 'ul' ? 'list-disc' : 'list-decimal'} pl-5 [&+*]:mt-2 marker:text-ink-muted`}>
            {b.items.map((item, j) => (
              <li key={j}>{inline(item)}</li>
            ))}
          </List>
        );
      })}
    </div>
  );
}
